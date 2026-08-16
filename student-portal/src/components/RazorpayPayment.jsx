import { useState } from 'react'
import apiClient from '../api/client'
import Button from './ui/Button'
import Spinner from './ui/Spinner'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'))
    document.body.appendChild(script)
  })
}

export default function RazorpayPayment({ paymentId, studentName, studentEmail, onSuccess, onError, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const startPayment = async () => {
    setLoading(true)
    setError(null)
    let paymentCompleted = false
    let checkoutCancelled = false
    const abandonCheckout = () => {
      if (paymentCompleted || checkoutCancelled) return
      checkoutCancelled = true
      onCancel?.()
    }
    try {
      await loadRazorpayScript()
      const { data: order } = await apiClient.post(`/payments/${paymentId}/razorpay/create-order`)

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'ARINSA AI MINDS',
        description: 'Internship Program Enrollment',
        prefill: { name: studentName, email: studentEmail },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          try {
            const { data: payment } = await apiClient.post(`/payments/${paymentId}/razorpay/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            paymentCompleted = true
            onSuccess(payment)
          } catch (err) {
            setError(err.response?.data?.detail || 'Payment verification failed')
            onError?.(err)
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
            abandonCheckout()
          },
        },
      })
      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment failed')
        setLoading(false)
        abandonCheckout()
      })
      rzp.open()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not start payment')
      setLoading(false)
      onError?.(err)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Button className="w-full" onClick={startPayment}>
          Pay with Razorpay
        </Button>
      )}
    </div>
  )
}
