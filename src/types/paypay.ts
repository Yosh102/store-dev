// types/paypay.d.ts
declare module '@paypayopa/paypayopa-sdk-node' {
    export interface PayPayConfig {
      clientId: string
      clientSecret: string
      merchantId: string
      productionMode: boolean
    }
  
    export interface PaymentAmount {
      amount: number
      currency: string
    }
  
    export interface OrderItem {
      name: string
      quantity: number
      unitPrice: PaymentAmount
    }
  
    export interface PaymentPayload {
      merchantPaymentId: string
      amount: PaymentAmount
      orderDescription: string
      orderItems?: OrderItem[]
      redirectUrl: string
      redirectType: string
    }
  
    export interface PaymentLink {
      rel: string
      href: string
      method?: string
    }
  
    export interface PaymentData {
      paymentId: string
      status: string
      acceptedAt?: number
      links: PaymentLink[]
    }
  
    export interface ResultInfo {
      code: string
      message: string
      codeId: string
    }
  
    export interface PaymentResponse {
      body: {
        resultInfo: ResultInfo
        data: PaymentData
      }
    }
  
    export interface WebhookData {
      paymentId: string
      merchantPaymentId: string
      userAuthorizationId: string
      amount: PaymentAmount
      requestedAt: number
      expiredAt?: number
    }
  
    export interface WebhookPayload {
      eventType: string
      data: WebhookData
    }
  
    export class PaymentApi {
      constructor(config: PayPayConfig)
      createPayment(payload: PaymentPayload): Promise<PaymentResponse>
      getPaymentDetails(merchantPaymentId: string): Promise<PaymentResponse>
      cancelPayment(merchantPaymentId: string): Promise<PaymentResponse>
      capturePayment(merchantPaymentId: string, payload: any): Promise<PaymentResponse>
      refundPayment(merchantPaymentId: string, payload: any): Promise<PaymentResponse>
    }
  }
  