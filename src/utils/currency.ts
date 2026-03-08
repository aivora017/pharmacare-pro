export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", minimumFractionDigits:2 }).format(n)
export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("en-IN").format(n)
export const formatCompact = (n: number): string =>
  n >= 100000 ? `₹${(n/100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n/1000).toFixed(1)}K`   :
  formatCurrency(n)
