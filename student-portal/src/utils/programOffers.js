export function hasActiveOffer(program) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return Boolean(
    Number(program?.offer_price_inr) > 0 &&
    Number(program?.offer_price_usd) > 0 &&
    program.offer_start_date &&
    program.offer_end_date &&
    program.offer_start_date <= today &&
    today <= program.offer_end_date,
  )
}

export function priceLabel(inr, usd, includeGst = false) {
  return `₹${inr}${includeGst ? ' + GST' : ''} / USD ${usd}`
}

export function offerExpiryLabel(program) {
  return program?.offer_end_date ? `Offer valid till ${new Date(`${program.offer_end_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
}
