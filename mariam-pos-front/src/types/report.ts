export interface SalesSummary  {
  totalVentas:number,
  totalDinero: number,
}

export interface DailySale {
  date: string;
  total: number;
}

export interface TopProduct {
  productName: string;
  _sum: { quantity: number };
}

export interface PaymentMethod {
  paymentMethod: string;
  _sum: { total: number };
}
