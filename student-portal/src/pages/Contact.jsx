import { useState } from 'react'
import './PrivacyPolicy.css'

const emptyForm = { full_name: '', email: '', phone: '', subject: '', message: '' }

export default function Contact() {
  const [form, setForm] = useState(emptyForm)
  const [done, setDone] = useState(false)
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const submit = (event) => {
    event.preventDefault()
    const body = `Name: ${form.full_name}\nEmail: ${form.email}\nPhone: ${form.phone || 'Not provided'}\n\n${form.message}`
    window.location.href = `mailto:recruitment@arinsaaiminds.com?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`
    setDone(true)
  }

  return (
    <main className="privacy-page contact-page">
      <div className="contact-heading">
        <p>ARINSA AI MINDS · CONTACT</p>
        <h1>Let&apos;s build<br /><em>what&apos;s next.</em></h1>
        <span>Questions about programmes, enrolment, careers, or the student portal? Send our team a message and we&apos;ll get back to you.</span>
      </div>
      <section className="contact-only">
        <article>
          <p className="contact-kicker">START A CONVERSATION</p>
          <h2>{done ? 'Thank you!' : 'Send a message'}</h2>
          {done ? (
            <div className="contact-thanks">
              <p>Your email draft has opened. Send it to deliver your message to ARINSA.</p>
              <button onClick={() => { setDone(false); setForm(emptyForm) }}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} className="contact-form">
              <div className="contact-row">
                <input required placeholder="Full name" value={form.full_name} onChange={update('full_name')} />
                <input required type="email" placeholder="Email address" value={form.email} onChange={update('email')} />
              </div>
              <div className="contact-row">
                <input placeholder="Phone number (optional)" value={form.phone} onChange={update('phone')} />
                <input required placeholder="Subject" value={form.subject} onChange={update('subject')} />
              </div>
              <textarea required placeholder="How can we help?" value={form.message} onChange={update('message')} />
              <button>Send message</button>
            </form>
          )}
        </article>
      </section>
    </main>
  )
}
