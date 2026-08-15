import hashlib
import hmac

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.program import Payment

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
RAZORPAY_MIN_AMOUNT_PAISE = 100  # Razorpay rejects orders below ₹1 / 100 paise


def create_order(payment: Payment) -> dict:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Razorpay is not configured on the server")

    amount_smallest_unit = int(round(float(payment.total_amount) * 100))
    if amount_smallest_unit < RAZORPAY_MIN_AMOUNT_PAISE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount is below Razorpay's minimum of {RAZORPAY_MIN_AMOUNT_PAISE} paise (₹1)",
        )

    try:
        response = httpx.post(
            RAZORPAY_ORDERS_URL,
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={
                "amount": amount_smallest_unit,
                "currency": payment.currency,
                "receipt": f"payment_{payment.id}",
                "notes": {"payment_id": str(payment.id), "enrollment_id": str(payment.enrollment_id)},
            },
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not reach Razorpay: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Razorpay rejected the API credentials")
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Razorpay order creation failed: {response.text}")

    return response.json()


def verify_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    payload = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, razorpay_signature)
