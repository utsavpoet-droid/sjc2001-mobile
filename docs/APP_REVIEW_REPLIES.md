# SJC 2001 — App Review responses (May 2026)

Two drafts to copy-paste:
1. **Unlisted App Distribution request form** (developer.apple.com/contact/request/unlisted-app)
2. **Reply to the 3.2 Business rejection** in App Store Connect

Both target the same conclusion: SJC 2001 is a private alumni app for one
~210-person batch, has no general-public audience by design, and Unlisted
Distribution is the right channel — which Apple itself has now suggested twice.

---

## 1) Unlisted App Distribution request

**Form fields**

- **App name:** SJC 2001
- **Bundle ID:** com.utsav.sjc2001
- **App Store Connect App ID:** *(fill from App Store Connect)*
- **Country/Region:** United States
- **Primary contact:** Utsav Srivastava — utsavpoet@gmail.com

**Describe how the app will be distributed (and to whom):**

> SJC 2001 is a private companion app for the 2001 graduating batch of
> St. Joseph's College (Allahabad, India) — approximately 210 alumni
> planning their 25-year (Silver Jubilee) reunion. Distribution is limited
> to verified batchmates only. We will share the unlisted App Store link
> inside the existing batch-only WhatsApp group and on the members-only
> website (sjcbatch2001.com), behind the same access-request flow already
> used to approve members on the website. The app will not be promoted on
> social media, search engines, or any public channel.

**Why this app is not appropriate for public distribution:**

> All content is batch-private: member directory with phone numbers,
> birthdays, and family photos; reunion event planning; trip cost-sharing
> and personal payment handles (Venmo / Zelle / UPI); committee documents
> and decisions. There is no public-facing surface, no signup-as-anyone
> flow, and no value to a non-batchmate. Every account is created by an
> admin after a manual access-request review against the alumni roster.
> Posting it to the public App Store has already been correctly identified
> by App Review (Guideline 3.2 Business, three reviews) as not the right
> channel — Unlisted is.

**Confirmations**

- The app is intended for a specific, identifiable group of users — yes.
- The audience is small and known in advance — yes (~80 alumni).
- The app will not be advertised publicly — yes.

---

## 2) Reply to the 3.2 Business rejection (App Store Connect)

> Hello App Review team,
>
> Thank you for the consistent feedback across the last three reviews —
> you are correct that SJC 2001 is a closed alumni app, not a
> general-audience product. To follow your own recommendation, we have now
> submitted a request for **Unlisted App Distribution** for this bundle ID
> (com.utsav.sjc2001). Once that request is approved, we will resubmit on
> the unlisted track and will not request public-store distribution again.
>
> A few things that may help confirm context for the unlisted review:
>
> 1. The audience is the ~210 alumni of the 2001 graduating batch of
>    St. Joseph's College, Allahabad. There is a corresponding members-only
>    website (sjcbatch2001.com) where every account is created via a
>    human-reviewed access request — the mobile app uses the same login.
> 2. The app has no public sign-up. The "Request Access" button on the
>    sign-in screen submits a request to a batch admin; new accounts are
>    only created after a manual roster check.
> 3. Demo credentials for review (already provided in the App Review
>    notes): username `test.user.1592`, password *(see notes)*. This is
>    a regular member account (not admin) pre-loaded with realistic but
>    synthetic data so the reviewer can see the trips / committees /
>    member-directory flows end-to-end. TOTP is disabled on this account.
> 4. Build 1.0.4 (this submission, intended for the unlisted track) adds:
>    persistent login with optional Face ID app-lock, trip task
>    assignments, and pre-filled Venmo / Zelle / PayPal / UPI deep links
>    for trip settle-ups.
>
> We will pause submissions on the public track and will not resubmit
> there. Please let us know if anything else is needed for the unlisted
> request to move forward.
>
> Thank you,
> Utsav Srivastava (developer)
> utsavpoet@gmail.com

---

## Demo account checklist (what App Review will see)

When filling App Review notes for the unlisted resubmit, include:

- **Username:** `test.user.1592` (regular member, not admin — display name
  "SJC 2001 Batch")
- **Password:** *(paste into notes)*
- **TOTP:** disabled on this account (note this explicitly so reviewers
  don't get blocked at the 2FA step)
- **Pre-loaded content tied to this user:** attendee on at least 1 active
  trip with expenses + a task + sample album; member of 1 committee with a
  document and a decision; visible in the directory with profile photo + city.

## Don't

- Don't re-litigate the public-store decision. Apple has been clear three
  times.
- Don't submit a resubmit while the unlisted request is pending — Apple
  warned about this explicitly on 2026-05-03.
- Don't add public discovery surfaces (sitemaps, public profile pages,
  etc.) — they undermine the "private audience" framing.
