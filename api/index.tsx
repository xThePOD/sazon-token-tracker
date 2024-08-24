import { Button, Frog, TextInput } from 'frog'
import { handle } from 'frog/vercel'
import { ethers } from 'ethers'
import fetch from 'node-fetch'

export const app = new Frog({
  basePath: '/api',
  imageOptions: { width: 1200, height: 630 },
  title: '$SAZON Token Tracker on Polygon',
})

const SAZON_TOKEN_ADDRESS = '0xf4EE4b895803b55F35802114Ce882231f26ac36D'
const ALCHEMY_POLYGON_URL = 'https://polygon-mainnet.g.alchemy.com/v2/fuugJa4wEcj_AUqO0Nji-cnmGpUUukQH'
const ALCHEMY_MAINNET_URL = 'https://eth-mainnet.g.alchemy.com/v2/fuugJa4wEcj_AUqO0Nji-cnmGpUUukQH'
const POLYGON_CHAIN_ID = 137
const FALLBACK_PRICE = 0.00000000 // Fallback price if unable to fetch

const ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

async function resolveAddress(input: unknown): Promise<string> {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Invalid input: Address or ENS name must be a non-empty string');
  }

  const trimmedInput = input.trim();

  if (ethers.isAddress(trimmedInput)) {
    return trimmedInput;
  }

  if ((trimmedInput as string).endsWith('.eth')) {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_MAINNET_URL);
    try {
      const address = await provider.resolveName(trimmedInput);
      if (address) {
        return address;
      }
    } catch (error) {
      console.error('Error resolving ENS name:', error);
    }
  }

  throw new Error('Invalid address or ENS name');
}

async function getSazonBalance(address: string): Promise<string> {
  try {
    console.log('Fetching balance for address:', address)
    const provider = new ethers.JsonRpcProvider(ALCHEMY_POLYGON_URL, POLYGON_CHAIN_ID)
    const contract = new ethers.Contract(SAZON_TOKEN_ADDRESS, ABI, provider)
    
    const balance = await contract.balanceOf(address)
    const decimals = await contract.decimals()
    
    const formattedBalance = ethers.formatUnits(balance, decimals)
    console.log('Fetched balance:', formattedBalance)
    return formattedBalance
  } catch (error) {
    console.error('Error in getSazonBalance:', error)
    return 'Error: Unable to fetch balance'
  }
}

async function getSazonUsdPrice(): Promise<number> {
  try {
    console.log('Fetching $SAZON price from DEX Screener...')
    const response = await fetch('https://app.uniswap.org/explore/tokens/polygon/0xf4ee4b895803b55f35802114ce882231f26ac36d')
    const data = await response.json()
    console.log('UNISWAP API response:', JSON.stringify(data, null, 2))

    if (data.pair && data.pair.priceUsd) {
      const priceUsd = parseFloat(data.pair.priceUsd)
      console.log('Fetched $SAZON price in USD:', priceUsd)
      return priceUsd
    } else {
      console.error('Invalid price data received from UNISWAP')
      return FALLBACK_PRICE
    }
  } catch (error) {
    console.error('Error in getSazonUsdPrice:', error)
    return FALLBACK_PRICE
  }
}

app.frame('/', (c) => {
  const { frameData, status } = c
  const errorMessage = status === 'response' ? frameData?.inputText : null
  
  return c.res({
    image: (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100%', 
        height: '100%', 
        backgroundImage: 'url(https://amaranth-adequate-condor-278.mypinata.cloud/ipfs/QmVfEoPSGHFGByQoGxUUwPq2qzE4uKXT7CSKVaigPANmjZ)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px', 
        boxSizing: 'border-box' 
      }}>
        <h1 style={{ 
          fontSize: '60px', 
          marginBottom: '20px', 
          textAlign: 'center',
          color: 'white',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
        }}>$GOLDIES Balance Checker</h1>
        <p style={{ 
          fontSize: '36px', 
          marginBottom: '20px', 
          textAlign: 'center',
          color: 'white',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
        }}>Enter your Polygon address or ENS name</p>
        {errorMessage && (
          <p style={{ fontSize: '18px', color: 'red', marginBottom: '20px', textAlign: 'center' }}>{errorMessage}</p>
        )}
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter address or ENS name" />,
      <Button action="/check">Check Balance</Button>,
    ]
  })
})

app.frame('/check', async (c) => {
  const { frameData, buttonValue } = c
  const input = frameData?.inputText || buttonValue

  if (!input) {
    return c.res({
      image: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#FF8B19', padding: '20px', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '20px', textAlign: 'center' }}>Error</h1>
          <p style={{ fontSize: '36px', textAlign: 'center' }}>Please enter a valid Polygon address or ENS name.</p>
        </div>
      ),
      intents: [
        <Button action="/">Back</Button>
      ]
    })
  }

  try {
    const address = await resolveAddress(input)
    console.log('Fetching balance and price for address:', address)
    const balance = await getSazonBalance(address)
    const priceUsd = await getSazonUsdPrice()

    let balanceDisplay = ''
    let usdValueDisplay = ''

    if (balance === '0.00') {
      balanceDisplay = "You don't have any $SAZON tokens on Polygon yet!"
    } else if (!balance.startsWith('Error')) {
      const balanceNumber = parseFloat(balance)
      balanceDisplay = `${balanceNumber.toLocaleString()} $SAZON on Polygon`
      
      const usdValue = balanceNumber * priceUsd
      console.log('Calculated USD value:', usdValue)
      usdValueDisplay = `(~$${usdValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD)`
    } else {
      balanceDisplay = balance
      usdValueDisplay = "Unable to calculate USD value"
    }

    return c.res({
      image: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#FF8B19', padding: '20px', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '60px', marginBottom: '20px', textAlign: 'center' }}>Your $SAZON Balance</h1>
          <p style={{ fontSize: '42px', textAlign: 'center' }}>{balanceDisplay}</p>
          <p style={{ fontSize: '42px', textAlign: 'center' }}>{usdValueDisplay}</p>
          <p style={{ fontSize: '32px', marginTop: '20px', textAlign: 'center' }}>Address: {address}</p>
          <p style={{ fontSize: '32px', marginTop: '10px', textAlign: 'center' }}>Network: Polygon (Chain ID: {POLYGON_CHAIN_ID})</p>
          <p style={{ fontSize: '26px', marginTop: '10px', textAlign: 'center' }}>Price: ${priceUsd.toFixed(8)} USD</p>
        </div>
      ),
      intents: [
        <Button action="/">Back</Button>,
        <Button.Link href="https://polygonscan.com/token/0xf4ee4b895803b55f35802114ce882231f26ac36d">Polygonscan</Button.Link>,
        <Button action="/check" value={input}>Reset</Button>,
      ]
    })
  } catch (error) {
    console.error('Error in balance check:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return c.res({
      image: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#FF8B19', padding: '20px', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '20px', textAlign: 'center' }}>Error</h1>
          <p style={{ fontSize: '36px', textAlign: 'center' }}>Unable to fetch balance or price. Please try again.</p>
          <p style={{ fontSize: '24px', textAlign: 'center' }}>Error details: {errorMessage}</p>
        </div>
      ),
      intents: [
        <Button action="/">Back</Button>,
        <Button action="/check" value={input}>Retry</Button>
      ]
    })
  }
})

export const GET = handle(app)
export const POST = handle(app)

