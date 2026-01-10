import  { Account } from '@aptos-labs/ts-sdk';

const account = Account.generate();
console.log('=== Your Backend Wallet ===');
console.log('Address:', account.accountAddress.toString());
console.log('Private Key:', account.privateKey.toString());
console.log('');
console.log('Add this to backend/.env:');
console.log(`BACKEND_WALLET_PRIVATE_KEY=${account.privateKey.toString()}`);