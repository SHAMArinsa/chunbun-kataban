export function hasActiveOffer(program) {
  // Portal V2: the backend decides whether an offer is live (timestamp windows).
  if (program && typeof program.offer_live === 'boolean') return program.offer_live
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

const fmtInr = (v) => Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtUsd = (v) => { const n = Number(v ?? 0); return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) }

export function priceLabel(inr, usd) {
  return `₹${fmtInr(inr)} / $${fmtUsd(usd)}`
}

/** The price a student actually pays: India pays the ₹ price + GST, everyone else the $ price + the international fee.
 * Percentages come from the program settings, so this always matches the payment page. */
export function feeLines(program, inr = program?.current_price_inr ?? program?.price_inr, usd = program?.current_price_usd ?? program?.price_usd) {
  const gst = Number(program?.gst_percent ?? 18)
  const fee = Number(program?.platform_fee_percent ?? 10)
  const inrTotal = Math.round(Number(inr) * (100 + gst)) / 100
  const usdTotal = Math.round(Number(usd) * (100 + fee)) / 100
  return [
    `India: ₹${fmtInr(inr)} + ${gst}% GST = ₹${fmtInr(inrTotal)}`,
    `International: $${fmtUsd(usd)} + ${fee}% fee = $${fmtUsd(usdTotal)}`,
  ]
}

export function feeNote(program, inr, usd) {
  return feeLines(program, inr, usd).join(' | ')
}

export function offerExpiryLabel(program) {
  if (program?.offer_end_at) return `Offer valid till ${new Date(program.offer_end_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  return program?.offer_end_date ? `Offer valid till ${new Date(`${program.offer_end_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
}

export function durationText(program) {
  const n = program?.duration ?? program?.duration_weeks
  const unit = String(program?.duration_unit || 'weeks').replace(/s$/, '')
  return `${n}-${unit.charAt(0).toUpperCase()}${unit.slice(1)}`
}
