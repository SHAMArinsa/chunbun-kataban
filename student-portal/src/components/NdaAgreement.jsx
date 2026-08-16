import { useState } from 'react'
import Button from './ui/Button'
import Input from './ui/Input'
import { NDA_TEXT } from '../content/nda'

export default function NdaAgreement({ fullName, onAccept, submitting }) {
  const [checked, setChecked] = useState(false)
  const [signature, setSignature] = useState('')
  const signatureMatches = signature.trim().toLowerCase() === (fullName ?? '').trim().toLowerCase() && signature.trim().length > 0
  const canContinue = checked && signatureMatches

  return <div className="space-y-4"><div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">{NDA_TEXT}</div><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I have read and agree to the ARINSA AI MINDS Confidentiality Agreement.</label><Input label={`Type your full legal name to sign ("${fullName ?? ''}")`} value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={fullName} />{signature && !signatureMatches && <p className="text-xs text-red-600">Signature must match your full name exactly.</p>}<Button className="w-full" disabled={!canContinue || submitting} onClick={() => onAccept(signature.trim())}>{submitting ? 'Submitting…' : 'Accept & Continue'}</Button></div>
}
