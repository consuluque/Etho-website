# Etho agent simulation: Harbour Paws demo week (1–5 Dec 2026)
Synthetic data. Nothing confirmed or sent; every recommendation needs the customer's OK (BOOK-01, MATCH-04).

## Milo
> Hi! Milo (Cavoodle, 8 kg) needs a full groom. Coat's curly but no knots. Any morning Tue–Thu, but he has to be done by 12.

**Quote:** Full groom (small) 90 min $95; Curly/dense coat +30 min +$25. **Total 120 min + 15 min cleaning, $120** (SVC-01, SVC-02, OPS-02)

**Best slot: Wed 2 Dec, 08:00–10:00 with Alex** (station and cleaning until 10:15). 3 valid slot(s) found.

Checks passed: eligibility (DOG-01/02/03), staff skills (staff table, STAFF-01), shift and lunch (WEEK roster, STAFF-01), one dog per groomer and 2 stations (OPS-02), bath first 20 min (SVC-03), customer window.

Revenue: $120 over 2.25 h = $53/groomer hour (`MATCH-03`).  **Below the $60 target: flag for review.**

Other valid options: Wed 2 Dec 08:15 (Alex), Wed 2 Dec 08:30 (Alex)

*Draft reply (needs customer to accept quote, BOOK-01):* "Hi! We can fit Milo in on Wed 2 Dec at 08:00 with Alex for a full groom, $120. Want us to lock it in?"

## Luna
> Can Luna (30 kg Lab) come in for a deshed? Wednesday or Friday afternoon, after 1pm.

**Quote:** Deshedding (large) 120 min $145. **Total 120 min + 15 min cleaning, $145** (SVC-01, OPS-02)

**Best slot: Fri 4 Dec, 14:45–16:45 with Alex** (station and cleaning until 17:00). 1 valid slot(s) found.

Checks passed: eligibility (DOG-01/02/03), staff skills (staff table, STAFF-01), shift and lunch (WEEK roster, STAFF-01), one dog per groomer and 2 stations (OPS-02), bath first 20 min (SVC-03), customer window.

Revenue: $145 over 2.25 h = $64/groomer hour (`MATCH-03`).

*Draft reply (needs customer to accept quote, BOOK-01):* "Hi! We can fit Luna in on Fri 4 Dec at 14:45 with Alex for a deshedding, $145. Want us to lock it in?"

## Archie
> Archie gets nervous, you've seen him before. Bath and brush please, Thu or Fri, but only before 11.

**Quote:** Bath & brush (medium) 60 min $75. **Total 60 min + 15 min cleaning, $75** (SVC-01, OPS-02)

**Decision: no valid slot in the requested window.** Why each option fails:

- Thu 3 Dec, Alex from 08:00: `OPS-02` Alex is with Duke 08:00–10:45; `OPS-02` Both stations taken at 09:00: Duke (Alex 08:00–10:45), Ollie (Sam 09:00–10:00); `SVC-03` Bath clash: Duke has the bath 08:00–08:20
- Thu 3 Dec, Jamie from 10:00: `STAFF` Anxious dogs must be with Alex (DOG-03); `Customer` Must finish by 11:00; `OPS-02` Jamie is with Nala 10:45–12:30
- Thu 3 Dec, Sam from 09:00: `STAFF` Anxious dogs must be with Alex (DOG-03); `OPS-02` Sam is with Ollie 09:00–10:00; `OPS-02` Both stations taken at 09:00: Duke (Alex 08:00–10:45), Ollie (Sam 09:00–10:00)
- Fri 4 Dec, Alex from 09:00: `OPS-02` Alex is with Hugo 09:30–12:15; `OPS-02` Both stations taken at 09:30: Loki (Jamie 09:00–10:45), Hugo (Alex 09:30–12:15); `SVC-03` Bath clash: Loki has the bath 09:00–09:20
- Fri 4 Dec, Jamie from 09:00: `STAFF` Anxious dogs must be with Alex (DOG-03); `OPS-02` Jamie is with Loki 09:00–10:45; `OPS-02` Both stations taken at 09:30: Loki (Jamie 09:00–10:45), Hugo (Alex 09:30–12:15)
- Fri 4 Dec, Sam from 10:00: `STAFF` Anxious dogs must be with Alex (DOG-03); `Customer` Must finish by 11:00; `OPS-02` Sam is with Bean 10:45–11:45

No slot fits anywhere this week. Offer next week or a waitlist.

## Ruby
> Hi, first time with you! Ruby is a 7 kg dachshund, just a bath. Saturday works. Not sure where her vaccination papers are.

**Decision: send to manager for review. No slot is offered.**

- `DOG-02` New customer without vaccination confirmation.
- `MATCH-04` Not opted in to marketing, so no proactive offers. Reply to their enquiry only.

*Draft reply:* "Thanks for getting in touch! Before we can book Ruby, our team needs to check a couple of details. We'll be in touch shortly."

## Olive
> Olive (6 kg, straight coat, no matting) needs a full groom, Thursday after 1pm. Could Jamie do her at 1?

**Quote:** Full groom (small) 90 min $95. **Total 90 min + 15 min cleaning, $95** (SVC-01, OPS-02)

**Best slot: Thu 3 Dec, 14:15–15:45 with Jamie** (station and cleaning until 16:00). 1 valid slot(s) found.

Checks passed: eligibility (DOG-01/02/03), staff skills (staff table, STAFF-01), shift and lunch (WEEK roster, STAFF-01), one dog per groomer and 2 stations (OPS-02), bath first 20 min (SVC-03), customer window.

Revenue: $95 over 1.75 h = $54/groomer hour (`MATCH-03`).  **Below the $60 target: flag for review.**

*Draft reply (needs customer to accept quote, BOOK-01):* "Hi! We can fit Olive in on Thu 3 Dec at 14:15 with Jamie for a full groom, $95. Want us to lock it in?"

## Biscuit
> Bath & brush for Biscuit (11 kg) on Friday, any time 10 to 12:30.

**Quote:** Bath & brush (medium) 60 min $75. **Total 60 min + 15 min cleaning, $75** (SVC-01, OPS-02)

**Decision: no valid slot in the requested window.** Why each option fails:

- Fri 4 Dec, Alex from 10:00: `OPS-02` Alex is with Hugo 09:30–12:15; `OPS-02` Both stations taken at 10:00: Loki (Jamie 09:00–10:45), Hugo (Alex 09:30–12:15)
- Fri 4 Dec, Jamie from 10:00: `OPS-02` Jamie is with Loki 09:00–10:45; `OPS-02` Both stations taken at 10:00: Loki (Jamie 09:00–10:45), Hugo (Alex 09:30–12:15)
- Fri 4 Dec, Sam from 10:00: `OPS-02` Sam is with Bean 10:45–11:45; `OPS-02` Both stations taken at 10:00: Loki (Jamie 09:00–10:45), Hugo (Alex 09:30–12:15)

Closest options outside their stated window (ask before offering):
- Tue 1 Dec 10:45–12:00 with Alex
- Tue 1 Dec 10:45–12:00 with Jamie
- Tue 1 Dec 11:00–12:15 with Alex

## Zeus
> Zeus is 43 kg and sheds everywhere, deshedding please, any day is fine.

**Decision: send to manager for review. No slot is offered.**

- `DOG-01` 43 kg is over 40 kg and manager approval isn't recorded.
- `MATCH-04` Not opted in to marketing, so no proactive offers. Reply to their enquiry only.

*Draft reply:* "Thanks for getting in touch! Before we can book Zeus, our team needs to check a couple of details. We'll be in touch shortly."

---
# Workshop test prompts

**Who's rostered Thursday at 10:30, and what can each do?**
- Alex (08:00–16:00): all sizes, complex coats, approved anxious dogs. At 10:30: busy with Duke until 10:45.
- Jamie (10:00–16:00): up to 25 kg, standard clips and deshedding, no reactive dogs. At 10:30: free.
- Sam (09:00–15:00): bath & brush and nail trims only, up to 15 kg. At 10:30: free.

**Can Olive go with Jamie, Thu 13:00?** No.
- `OPS-02` Both stations taken at 13:30: Peach (Sam 13:00–14:15), Scout (Alex 13:30–15:45)
- `SVC-03` Bath clash: Peach has the bath 13:00–13:20
- Earliest with Jamie instead: Thu 14:15–16:00.

**Paw balm offer as of the snapshot (Mon 30 Nov, 10:00)** (`OFFER-01`): the slot must start within 48 hours, so by Wed 2 Dec 10:00. Only Tue 10:00–14:00 starts and a Wed 10:00 start can qualify.
- Standard-coat small full groom + paw balm: none
- Standard-coat medium full groom + paw balm: none
- Standard-coat large full groom + paw balm: none
- Why none: a small full groom *without* the balm fits exactly on Tue 1 Dec 10:45–12:30 with Alex, but the balm's extra 5 minutes would run into the 12:30 lunch break. The rule says the extra time must fit, so it doesn't qualify.