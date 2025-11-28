// lib/paypay.ts (動的インポート版)
let paypayopa: any = null
let isConfigured = false

const initializePayPay = async () => {
  if (!paypayopa) {
    paypayopa = await import('@paypayopa/paypayopa-sdk-node')
  }
  
  if (!isConfigured) {
    paypayopa.Configure({
      clientId: process.env.PAYPAY_API_KEY!,
      clientSecret: process.env.PAYPAY_API_SECRET!,
      merchantId: process.env.PAYPAY_MERCHANT_ID!,
      productionMode: process.env.PAYPAY_ENVIRONMENT === 'production'
    })
    isConfigured = true
  }
  
  return paypayopa
}

// PayPay決済作成
export const createPayPayPayment = async (payload: any) => {
  try {
    const sdk = await initializePayPay()
    const response = await sdk.QRCodeCreate(payload)
    return response
  } catch (error) {
    console.error('PayPay QRCodeCreate error:', error)
    throw error
  }
}

// PayPay決済詳細取得
export const getPayPayPaymentDetails = async (merchantPaymentId: string) => {
  try {
    const sdk = await initializePayPay()
    const response = await sdk.GetPaymentDetails(merchantPaymentId)
    return response
  } catch (error) {
    console.error('PayPay GetPaymentDetails error:', error)
    throw error
  }
}

// PayPay決済キャンセル
export const cancelPayPayPayment = async (merchantPaymentId: string) => {
  try {
    const sdk = await initializePayPay()
    const response = await sdk.CancelPayment(merchantPaymentId)
    return response
  } catch (error) {
    console.error('PayPay CancelPayment error:', error)
    throw error
  }
}

// PayPay返金
export const refundPayPayPayment = async (merchantRefundId: string, paymentId: string, amount: number) => {
  try {
    const sdk = await initializePayPay()
    const refundPayload = {
      merchantRefundId: merchantRefundId,
      paymentId: paymentId,
      amount: {
        amount: amount,
        currency: 'JPY'
      },
      reason: 'Customer request'
    }
    
    const response = await sdk.RefundPayment(refundPayload)
    return response
  } catch (error) {
    console.error('PayPay RefundPayment error:', error)
    throw error
  }
}