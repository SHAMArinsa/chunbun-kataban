export function hasActiveOffer(program) {
  const today = new Date().toISOString().slice(0, 10)
  return Boolean(program?.offer_price_inr && program?.offer_price_usd && program.offer_start_date <= today && today <= program.offer_end_date)
}

export function priceLabel(inr, usd, includeGst = false) {
  return `₹${inr}${includeGst ? ' + GST' : ''} / USD ${usd}`
}

export function offerExpiryLabel(program) {
  return program?.offer_end_date ? `Offer valid till ${new Date(`${program.offer_end_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
}
