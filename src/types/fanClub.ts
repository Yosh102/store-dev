export interface FanClub {
    id: string
    name: string
    description: string
    coverImage: string
    members: string[]
    subscriptionPlans: {
      monthly: {
        priceId: string
        amount: number
      }
      yearly: {
        priceId: string
        amount: number
      }
    }
  }
  
  