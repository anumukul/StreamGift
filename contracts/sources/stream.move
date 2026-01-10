module streamgift::stream {
    use std::error;
    use std::signer;
    use std::vector;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::aptos_account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_std::table::{Self, Table};

    // ============================================
    // ERROR CODES
    // ============================================
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_STREAM_NOT_FOUND: u64 = 3;
    const E_NOT_STREAM_SENDER: u64 = 4;
    const E_NOT_STREAM_RECIPIENT: u64 = 5;
    const E_STREAM_NOT_ACTIVE: u64 = 6;
    const E_INSUFFICIENT_BALANCE: u64 = 7;
    const E_INVALID_DURATION: u64 = 8;
    const E_INVALID_AMOUNT: u64 = 9;
    const E_STREAM_NOT_STARTED: u64 = 10;
    const E_CLAIM_AMOUNT_TOO_HIGH: u64 = 11;
    const E_STREAM_ALREADY_CANCELLED: u64 = 12;
    const E_ZERO_CLAIMABLE: u64 = 13;
    const E_NOT_ADMIN: u64 = 14;
    const E_SOCIAL_HASH_MISMATCH: u64 = 15;

    // ============================================
    // CONSTANTS
    // ============================================
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_PAUSED: u8 = 2;
    const STATUS_COMPLETED: u8 = 3;
    const STATUS_CANCELLED: u8 = 4;

    const PROTOCOL_FEE_BPS: u64 = 25;  // 0.25%
    const BPS_DENOMINATOR: u64 = 10000;

    // ============================================
    // STRUCTS
    // ============================================
    
    struct Stream has store, drop, copy {
        id: u64,
        sender: address,
        recipient: address,
        recipient_social_hash: vector<u8>,
        total_amount: u64,
        claimed_amount: u64,
        rate_per_second: u64,
        start_time: u64,
        end_time: u64,
        last_claim_time: u64,
        message: String,
        status: u8,
        created_at: u64,
    }

    struct StreamStore has key {
        streams: Table<u64, Stream>,
        next_stream_id: u64,
        escrow: Coin<AptosCoin>,
        fee_collected: u64,
        admin: address,
        stream_created_events: EventHandle<StreamCreatedEvent>,
        stream_claimed_events: EventHandle<StreamClaimedEvent>,
        stream_cancelled_events: EventHandle<StreamCancelledEvent>,
        recipient_updated_events: EventHandle<RecipientUpdatedEvent>,
    }

    struct UserStreamIndex has key {
        outgoing_stream_ids: vector<u64>,
        incoming_stream_ids: vector<u64>,
    }

    struct RecipientMapping has key {
        social_to_address: Table<vector<u8>, address>,
        address_to_social: Table<address, vector<u8>>,
    }

    // ============================================
    // EVENTS
    // ============================================
    
    struct StreamCreatedEvent has drop, store {
        stream_id: u64,
        sender: address,
        recipient: address,
        recipient_social_hash: vector<u8>,
        total_amount: u64,
        duration: u64,
        start_time: u64,
    }

    struct StreamClaimedEvent has drop, store {
        stream_id: u64,
        recipient: address,
        amount_claimed: u64,
        total_claimed: u64,
    }

    struct StreamCancelledEvent has drop, store {
        stream_id: u64,
        sender: address,
        amount_refunded: u64,
        amount_to_recipient: u64,
    }

    struct RecipientUpdatedEvent has drop, store {
        stream_id: u64,
        old_recipient: address,
        new_recipient: address,
        social_hash: vector<u8>,
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /// Initialize the contract. Only needs to be called once by the admin.
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        assert!(!exists<StreamStore>(admin_addr), error::already_exists(E_ALREADY_INITIALIZED));

        move_to(admin, StreamStore {
            streams: table::new(),
            next_stream_id: 1,
            escrow: coin::zero<AptosCoin>(),
            fee_collected: 0,
            admin: admin_addr,
            stream_created_events: account::new_event_handle<StreamCreatedEvent>(admin),
            stream_claimed_events: account::new_event_handle<StreamClaimedEvent>(admin),
            stream_cancelled_events: account::new_event_handle<StreamCancelledEvent>(admin),
            recipient_updated_events: account::new_event_handle<RecipientUpdatedEvent>(admin),
        });

        move_to(admin, RecipientMapping {
            social_to_address: table::new(),
            address_to_social: table::new(),
        });
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /// Register a social hash to a wallet address (called by backend when creating streams to email/twitter)
    public entry fun register_recipient(
        admin: &signer,
        social_hash: vector<u8>,
        recipient_address: address,
    ) acquires RecipientMapping, StreamStore {
        let admin_addr = signer::address_of(admin);
        
        // Verify admin
        assert!(exists<StreamStore>(admin_addr), error::permission_denied(E_NOT_ADMIN));
        let store = borrow_global<StreamStore>(admin_addr);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));
        
        let mapping = borrow_global_mut<RecipientMapping>(admin_addr);
        
        if (!table::contains(&mapping.social_to_address, social_hash)) {
            table::add(&mut mapping.social_to_address, social_hash, recipient_address);
            table::add(&mut mapping.address_to_social, recipient_address, social_hash);
        };
    }

    /// Update the recipient of a stream when the actual user claims via email/social
    /// This is the KEY function for email-based claiming!
    /// Called by the backend when a user authenticates via email and wants to claim
    public entry fun update_stream_recipient(
        admin: &signer,
        contract_address: address,
        stream_id: u64,
        new_recipient: address,
        social_hash: vector<u8>,
    ) acquires StreamStore, RecipientMapping {
        let admin_addr = signer::address_of(admin);
        
        // Verify this is called by the contract admin
        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global_mut<StreamStore>(contract_address);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));
        
        // Get the stream
        assert!(table::contains(&store.streams, stream_id), error::not_found(E_STREAM_NOT_FOUND));
        let stream = table::borrow_mut(&mut store.streams, stream_id);
        
        // Verify the social hash matches (ensures the claimer owns the email/twitter)
        assert!(stream.recipient_social_hash == social_hash, error::invalid_argument(E_SOCIAL_HASH_MISMATCH));
        
        // Store old recipient for event
        let old_recipient = stream.recipient;
        
        // Update the recipient address
        stream.recipient = new_recipient;
        
        // Update the recipient mapping
        if (exists<RecipientMapping>(contract_address)) {
            let mapping = borrow_global_mut<RecipientMapping>(contract_address);
            
            // Remove old mapping if exists
            if (table::contains(&mapping.social_to_address, social_hash)) {
                table::remove(&mut mapping.social_to_address, social_hash);
            };
            if (table::contains(&mapping.address_to_social, old_recipient)) {
                table::remove(&mut mapping.address_to_social, old_recipient);
            };
            
            // Add new mapping
            table::add(&mut mapping.social_to_address, social_hash, new_recipient);
            table::add(&mut mapping.address_to_social, new_recipient, social_hash);
        };
        
        // Emit event
        event::emit_event(&mut store.recipient_updated_events, RecipientUpdatedEvent {
            stream_id,
            old_recipient,
            new_recipient,
            social_hash,
        });
    }

    /// Withdraw collected fees (admin only)
    public entry fun withdraw_fees(
        admin: &signer,
        contract_address: address,
        amount: u64,
    ) acquires StreamStore {
        let admin_addr = signer::address_of(admin);

        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));
        let store = borrow_global_mut<StreamStore>(contract_address);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));
        assert!(amount <= store.fee_collected, error::invalid_argument(E_INSUFFICIENT_BALANCE));

        store.fee_collected = store.fee_collected - amount;
        let fee_payment = coin::extract(&mut store.escrow, amount);
        coin::deposit(admin_addr, fee_payment);
    }

    /// Admin claim on behalf of recipient (for custodial wallets that can't sign Aptos txs)
    public entry fun admin_claim_for_recipient(
        admin: &signer,
        contract_address: address,
        stream_id: u64,
        recipient_address: address,
        amount: u64,
    ) acquires StreamStore {
        let admin_addr = signer::address_of(admin);

        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        let store = borrow_global_mut<StreamStore>(contract_address);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));
        assert!(table::contains(&store.streams, stream_id), error::not_found(E_STREAM_NOT_FOUND));

        let stream = table::borrow_mut(&mut store.streams, stream_id);

        assert!(stream.recipient == recipient_address, error::permission_denied(E_NOT_STREAM_RECIPIENT));
        assert!(stream.status == STATUS_ACTIVE, error::invalid_state(E_STREAM_NOT_ACTIVE));

        let claimable = calculate_claimable_internal(stream);
        assert!(claimable > 0, error::invalid_state(E_ZERO_CLAIMABLE));

        let claim_amount = if (amount == 0 || amount > claimable) { claimable } else { amount };

        stream.claimed_amount = stream.claimed_amount + claim_amount;
        stream.last_claim_time = timestamp::now_seconds();

        if (stream.claimed_amount >= stream.total_amount) {
            stream.status = STATUS_COMPLETED;
        };

        let payment = coin::extract(&mut store.escrow, claim_amount);
        aptos_account::deposit_coins(recipient_address, payment);

        event::emit_event(&mut store.stream_claimed_events, StreamClaimedEvent {
            stream_id,
            recipient: recipient_address,
            amount_claimed: claim_amount,
            total_claimed: stream.claimed_amount,
        });
    }

    /// Admin cancel stream on behalf of sender (for custodial architecture)
    public entry fun admin_cancel_stream(
        admin: &signer,
        contract_address: address,
        stream_id: u64,
        sender_address: address,
    ) acquires StreamStore {
        let admin_addr = signer::address_of(admin);

        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        let store = borrow_global_mut<StreamStore>(contract_address);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));
        assert!(table::contains(&store.streams, stream_id), error::not_found(E_STREAM_NOT_FOUND));

        let stream = table::borrow_mut(&mut store.streams, stream_id);

        assert!(stream.sender == sender_address, error::permission_denied(E_NOT_STREAM_SENDER));
        assert!(stream.status == STATUS_ACTIVE, error::invalid_state(E_STREAM_ALREADY_CANCELLED));

        let claimable = calculate_claimable_internal(stream);
        let remaining = stream.total_amount - stream.claimed_amount - claimable;

        stream.status = STATUS_CANCELLED;

        if (claimable > 0) {
            let recipient_payment = coin::extract(&mut store.escrow, claimable);
            aptos_account::deposit_coins(stream.recipient, recipient_payment);
        };

        if (remaining > 0) {
            let refund = coin::extract(&mut store.escrow, remaining);
            aptos_account::deposit_coins(sender_address, refund);
        };

        event::emit_event(&mut store.stream_cancelled_events, StreamCancelledEvent {
            stream_id,
            sender: sender_address,
            amount_refunded: remaining,
            amount_to_recipient: claimable,
        });
    }

    // ============================================
    // USER FUNCTIONS
    // ============================================

    /// Optional: Initialize user stream index before receiving streams
    public entry fun init_user_index(user: &signer) {
        let user_addr = signer::address_of(user);
        
        if (!exists<UserStreamIndex>(user_addr)) {
            move_to(user, UserStreamIndex {
                outgoing_stream_ids: vector::empty(),
                incoming_stream_ids: vector::empty(),
            });
        };
    }

    /// Create a new stream (original function - kept for backward compatibility)
    public entry fun create_stream(
        sender: &signer,
        contract_address: address,
        recipient_address: address,
        recipient_social_hash: vector<u8>,
        amount: u64,
        duration_seconds: u64,
        start_time: u64,
        message: String,
    ) acquires StreamStore, UserStreamIndex {
        let sender_addr = signer::address_of(sender);

        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(duration_seconds > 0, error::invalid_argument(E_INVALID_DURATION));
        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        // Calculate fee and stream amount
        let fee = (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        let stream_amount = amount - fee;
        let rate_per_second = stream_amount / duration_seconds;

        // Calculate times
        let current_time = timestamp::now_seconds();
        let actual_start_time = if (start_time == 0) { current_time } else { start_time };
        let end_time = actual_start_time + duration_seconds;

        // Transfer tokens to escrow
        let payment = coin::withdraw<AptosCoin>(sender, amount);

        let store = borrow_global_mut<StreamStore>(contract_address);
        coin::merge(&mut store.escrow, payment);
        store.fee_collected = store.fee_collected + fee;

        // Create stream
        let stream_id = store.next_stream_id;
        store.next_stream_id = stream_id + 1;

        let stream = Stream {
            id: stream_id,
            sender: sender_addr,
            recipient: recipient_address,
            recipient_social_hash,
            total_amount: stream_amount,
            claimed_amount: 0,
            rate_per_second,
            start_time: actual_start_time,
            end_time,
            last_claim_time: actual_start_time,
            message,
            status: STATUS_ACTIVE,
            created_at: current_time,
        };

        table::add(&mut store.streams, stream_id, stream);

        // Emit event
        event::emit_event(&mut store.stream_created_events, StreamCreatedEvent {
            stream_id,
            sender: sender_addr,
            recipient: recipient_address,
            recipient_social_hash: copy recipient_social_hash,
            total_amount: stream_amount,
            duration: duration_seconds,
            start_time: actual_start_time,
        });

        // Update sender's stream index
        if (!exists<UserStreamIndex>(sender_addr)) {
            move_to(sender, UserStreamIndex {
                outgoing_stream_ids: vector::empty(),
                incoming_stream_ids: vector::empty(),
            });
        };

        let sender_index = borrow_global_mut<UserStreamIndex>(sender_addr);
        vector::push_back(&mut sender_index.outgoing_stream_ids, stream_id);
    }

    /// Create a new stream (admin creates on behalf of sender for custodial architecture)
    public entry fun admin_create_stream(
        admin: &signer,
        contract_address: address,
        sender_address: address,
        recipient_address: address,
        recipient_social_hash: vector<u8>,
        amount: u64,
        duration_seconds: u64,
        start_time: u64,
        message: String,
    ) acquires StreamStore {
        let admin_addr = signer::address_of(admin);

        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(duration_seconds > 0, error::invalid_argument(E_INVALID_DURATION));
        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        // Verify admin
        let store = borrow_global_mut<StreamStore>(contract_address);
        assert!(store.admin == admin_addr, error::permission_denied(E_NOT_ADMIN));

        // Calculate fee and stream amount
        let fee = (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        let stream_amount = amount - fee;
        let rate_per_second = stream_amount / duration_seconds;

        // Calculate times
        let current_time = timestamp::now_seconds();
        let actual_start_time = if (start_time == 0) { current_time } else { start_time };
        let end_time = actual_start_time + duration_seconds;

        // Transfer tokens from admin to escrow (admin pre-funded by user)
        let payment = coin::withdraw<AptosCoin>(admin, amount);
        coin::merge(&mut store.escrow, payment);
        store.fee_collected = store.fee_collected + fee;

        // Create stream with original sender address (not admin)
        let stream_id = store.next_stream_id;
        store.next_stream_id = stream_id + 1;

        let stream = Stream {
            id: stream_id,
            sender: sender_address,
            recipient: recipient_address,
            recipient_social_hash,
            total_amount: stream_amount,
            claimed_amount: 0,
            rate_per_second,
            start_time: actual_start_time,
            end_time,
            last_claim_time: actual_start_time,
            message,
            status: STATUS_ACTIVE,
            created_at: current_time,
        };

        table::add(&mut store.streams, stream_id, stream);

        // Emit event
        event::emit_event(&mut store.stream_created_events, StreamCreatedEvent {
            stream_id,
            sender: sender_address,
            recipient: recipient_address,
            recipient_social_hash: copy recipient_social_hash,
            total_amount: stream_amount,
            duration: duration_seconds,
            start_time: actual_start_time,
        });
    }

    /// Claim from a stream
    public entry fun claim_stream(
        recipient: &signer,
        contract_address: address,
        stream_id: u64,
        amount: u64,
    ) acquires StreamStore, UserStreamIndex {
        let recipient_addr = signer::address_of(recipient);
        
        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        let store = borrow_global_mut<StreamStore>(contract_address);
        
        assert!(table::contains(&store.streams, stream_id), error::not_found(E_STREAM_NOT_FOUND));

        let stream = table::borrow_mut(&mut store.streams, stream_id);
        
        // IMPORTANT: The recipient must match the stream's recipient address
        // For email claims, update_stream_recipient must be called first!
        assert!(stream.recipient == recipient_addr, error::permission_denied(E_NOT_STREAM_RECIPIENT));
        assert!(stream.status == STATUS_ACTIVE, error::invalid_state(E_STREAM_NOT_ACTIVE));

        // Calculate claimable amount
        let claimable = calculate_claimable_internal(stream);
        assert!(claimable > 0, error::invalid_state(E_ZERO_CLAIMABLE));

        let claim_amount = if (amount == 0 || amount > claimable) { claimable } else { amount };

        // Update stream state
        stream.claimed_amount = stream.claimed_amount + claim_amount;
        stream.last_claim_time = timestamp::now_seconds();

        if (stream.claimed_amount >= stream.total_amount) {
            stream.status = STATUS_COMPLETED;
        };

        // Transfer tokens to recipient (auto-registers coin store if needed)
        let payment = coin::extract(&mut store.escrow, claim_amount);
        aptos_account::deposit_coins(recipient_addr, payment);

        // Emit event
        event::emit_event(&mut store.stream_claimed_events, StreamClaimedEvent {
            stream_id,
            recipient: recipient_addr,
            amount_claimed: claim_amount,
            total_claimed: stream.claimed_amount,
        });

        // Update recipient's stream index (using their own signer)
        if (!exists<UserStreamIndex>(recipient_addr)) {
            move_to(recipient, UserStreamIndex {
                outgoing_stream_ids: vector::empty(),
                incoming_stream_ids: vector::empty(),
            });
        };
        
        let recipient_index = borrow_global_mut<UserStreamIndex>(recipient_addr);
        if (!vector::contains(&recipient_index.incoming_stream_ids, &stream_id)) {
            vector::push_back(&mut recipient_index.incoming_stream_ids, stream_id);
        };
    }

    /// Cancel a stream (sender only)
    public entry fun cancel_stream(
        sender: &signer,
        contract_address: address,
        stream_id: u64,
    ) acquires StreamStore {
        let sender_addr = signer::address_of(sender);
        
        assert!(exists<StreamStore>(contract_address), error::not_found(E_NOT_INITIALIZED));

        let store = borrow_global_mut<StreamStore>(contract_address);
        
        assert!(table::contains(&store.streams, stream_id), error::not_found(E_STREAM_NOT_FOUND));

        let stream = table::borrow_mut(&mut store.streams, stream_id);
        
        assert!(stream.sender == sender_addr, error::permission_denied(E_NOT_STREAM_SENDER));
        assert!(stream.status == STATUS_ACTIVE, error::invalid_state(E_STREAM_ALREADY_CANCELLED));

        // Calculate amounts
        let claimable = calculate_claimable_internal(stream);
        let remaining = stream.total_amount - stream.claimed_amount - claimable;

        stream.status = STATUS_CANCELLED;

        // Send accrued amount to recipient (auto-registers coin store if needed)
        if (claimable > 0) {
            let recipient_payment = coin::extract(&mut store.escrow, claimable);
            aptos_account::deposit_coins(stream.recipient, recipient_payment);
        };

        // Refund remaining to sender
        if (remaining > 0) {
            let refund = coin::extract(&mut store.escrow, remaining);
            coin::deposit(sender_addr, refund);
        };

        // Emit event
        event::emit_event(&mut store.stream_cancelled_events, StreamCancelledEvent {
            stream_id,
            sender: sender_addr,
            amount_refunded: remaining,
            amount_to_recipient: claimable,
        });
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    fun calculate_claimable_internal(stream: &Stream): u64 {
        if (stream.status != STATUS_ACTIVE) {
            return 0
        };

        let current_time = timestamp::now_seconds();
        
        if (current_time < stream.start_time) {
            return 0
        };

        let effective_time = if (current_time > stream.end_time) {
            stream.end_time
        } else {
            current_time
        };

        let elapsed = effective_time - stream.last_claim_time;
        let accrued = elapsed * stream.rate_per_second;
        let remaining = stream.total_amount - stream.claimed_amount;

        if (accrued > remaining) { remaining } else { accrued }
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    #[view]
    public fun get_stream(contract_address: address, stream_id: u64): (
        u64,        // id
        address,    // sender
        address,    // recipient
        vector<u8>, // recipient_social_hash
        u64,        // total_amount
        u64,        // claimed_amount
        u64,        // rate_per_second
        u64,        // start_time
        u64,        // end_time
        u64,        // last_claim_time
        String,     // message
        u8,         // status
        u64         // created_at
    ) acquires StreamStore {
        let store = borrow_global<StreamStore>(contract_address);
        let stream = table::borrow(&store.streams, stream_id);
        (
            stream.id,
            stream.sender,
            stream.recipient,
            stream.recipient_social_hash,
            stream.total_amount,
            stream.claimed_amount,
            stream.rate_per_second,
            stream.start_time,
            stream.end_time,
            stream.last_claim_time,
            stream.message,
            stream.status,
            stream.created_at
        )
    }

    #[view]
    public fun get_claimable(contract_address: address, stream_id: u64): u64 acquires StreamStore {
        let store = borrow_global<StreamStore>(contract_address);
        let stream = table::borrow(&store.streams, stream_id);
        calculate_claimable_internal(stream)
    }

    #[view]
    public fun get_stream_count(contract_address: address): u64 acquires StreamStore {
        let store = borrow_global<StreamStore>(contract_address);
        store.next_stream_id - 1
    }

    #[view]
    public fun get_fee_collected(contract_address: address): u64 acquires StreamStore {
        let store = borrow_global<StreamStore>(contract_address);
        store.fee_collected
    }

    #[view]
    public fun get_user_outgoing_streams(user_address: address): vector<u64> acquires UserStreamIndex {
        if (!exists<UserStreamIndex>(user_address)) {
            return vector::empty()
        };
        let index = borrow_global<UserStreamIndex>(user_address);
        index.outgoing_stream_ids
    }

    #[view]
    public fun get_user_incoming_streams(user_address: address): vector<u64> acquires UserStreamIndex {
        if (!exists<UserStreamIndex>(user_address)) {
            return vector::empty()
        };
        let index = borrow_global<UserStreamIndex>(user_address);
        index.incoming_stream_ids
    }

    #[view]
    public fun get_recipient_address(
        contract_address: address, 
        social_hash: vector<u8>
    ): address acquires RecipientMapping {
        let mapping = borrow_global<RecipientMapping>(contract_address);
        *table::borrow(&mapping.social_to_address, social_hash)
    }

    #[view]
    public fun is_initialized(contract_address: address): bool {
        exists<StreamStore>(contract_address)
    }

    #[view]
    public fun get_admin(contract_address: address): address acquires StreamStore {
        let store = borrow_global<StreamStore>(contract_address);
        store.admin
    }
}
