import { useSignMessage } from 'wagmi';
import axios from 'axios';

export const useWalletLink = () => {
  const { signMessageAsync } = useSignMessage();

  const linkEthereumWallet = async (address) => {
    try {
      // 1. Fetch nonce from backend
      const { data: { nonce } } = await axios.get('/api/auth/nonce');
      
      // 2. Format EIP-4361 message
      const message = `Welcome to the Platform.\nClick "Sign" to link this wallet to your account.\n\nNonce: ${nonce}`;
      
      // 3. User signs message
      const signature = await signMessageAsync({ message });
      
      // 4. Verify on backend & link
      await axios.post('/api/auth/link-wallet', {
        address,
        message,
        signature,
        chain: 'ethereum'
      });
      
      alert('Wallet successfully linked!');
    } catch (err) {
      console.error('Wallet linking failed', err);
    }
  };

  return { linkEthereumWallet };
};
