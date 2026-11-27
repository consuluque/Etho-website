"""Simulated Etho agent: enquiry -> structured request -> rule checks -> recommendation + draft reply.

The parsing step (free text -> Request) is what an LLM does in production. Here each
enquiry carries the structured version an LLM would produce, so the run is repeatable.
Nothing is confirmed or sent (MATCH-04, WEEK section 2).
"""
import sys
from engine import *

ENQUIRIES = [
 ("Milo", "Hi! Milo (Cavoodle, 8 kg) needs a full groom. Coat's curly but no knots. Any morning Tue–Thu, but he has to be done by 12.",
  Request("Milo", 8, "full_groom", coat="curly", opted_in=True, days=["Tue","Wed","Thu"],
          finish_by={"Tue":"12:00","Wed":"12:00","Thu":"12:00"})),
 ("Luna", "Can Luna (30 kg Lab) come in for a deshed? Wednesday or Friday afternoon, after 1pm.",
  Request("Luna", 30, "deshedding", opted_in=True, days=["Wed","Fri"], earliest={"Wed":"13:00","Fri":"13:00"})),
 ("Archie", "Archie gets nervous, you've seen him before. Bath and brush please, Thu or Fri, but only before 11.",
  Request("Archie", 12, "bath_brush", anxious=True, anxious_approved=True, opted_in=True, days=["Thu","Fri"],
          finish_by={"Thu":"11:00","Fri":"11:00"})),
 ("Ruby", "Hi, first time with you! Ruby is a 7 kg dachshund, just a bath. Saturday works. Not sure where her vaccination papers are.",
  Request("Ruby", 7, "bath_brush", new_customer=True, vaccinated=None, opted_in=False, days=["Sat"])),
 ("Olive", "Olive (6 kg, straight coat, no matting) needs a full groom, Thursday after 1pm. Could Jamie do her at 1?",
  Request("Olive", 6, "full_groom", opted_in=True, days=["Thu"], earliest={"Thu":"13:00"})),
 ("Biscuit", "Bath & brush for Biscuit (11 kg) on Friday, any time 10 to 12:30.",
  Request("Biscuit", 11, "bath_brush", opted_in=True, days=["Fri"], earliest={"Fri":"10:00"}, finish_by={"Fri":"12:30"})),
 ("Zeus", "Zeus is 43 kg and sheds everywhere, deshedding please, any day is fine.",
  Request("Zeus", 43, "deshedding", opted_in=False)),
]

def handle(name, text, r, out):
    out.append(f"\n## {name}\n> {text}\n")
    issues = eligibility(r)
    if issues:
        out.append("**Decision: send to manager for review. No slot is offered.**\n")
        for rule, msg in issues: out.append(f"- `{rule}` {msg}")
        if not r.opted_in: out.append("- `MATCH-04` Not opted in to marketing, so no proactive offers. Reply to their enquiry only.")
        out.append("\n*Draft reply:* \"Thanks for getting in touch! Before we can book "
                   f"{name}, our team needs to check a couple of details. We'll be in touch shortly.\"")
        return
    mins, price, rules, lines = quote(r)
    out.append("**Quote:** " + "; ".join(lines) + f". **Total {mins} min + 15 min cleaning, ${price}** ({', '.join(sorted(set(rules)))}, OPS-02)\n")
    slots = find_slots(r)
    if not slots:
        out.append("**Decision: no valid slot in the requested window.** Why each option fails:\n")
        for day in r.days:
            for staff in ROSTER.get(day, {}):
                # show the most informative failure for the customer's earliest acceptable start
                s0 = max(t(ROSTER[day][staff][0]), t(r.earliest.get(day, "00:00")))
                ok, end, fails = check_slot(r, day, staff, s0)
                out.append(f"- {DATES[day]}, {staff} from {hm(s0)}: " + "; ".join(f"`{a}` {b}" for a, b in fails[:3]))
        alt_r = Request(**{**r.__dict__, "days": list(DAYS), "earliest": {}, "finish_by": {}})
        alts = find_slots(alt_r)[:3]
        if alts:
            out.append("\nClosest options outside their stated window (ask before offering):")
            for d, s, a, b in alts: out.append(f"- {DATES[d]} {hm(a)}–{hm(b)} with {s}")
        else:
            out.append("\nNo slot fits anywhere this week. Offer next week or a waitlist.")
        return
    d, s, a, b = slots[0]
    rph = revenue_per_hour(price, a, b)
    out.append(f"**Best slot: {DATES[d]}, {hm(a)}–{hm(b - 15)} with {s}** (station and cleaning until {hm(b)}). "
               f"{len(slots)} valid slot(s) found.\n")
    out.append("Checks passed: eligibility (DOG-01/02/03), staff skills (staff table, STAFF-01), shift and lunch (WEEK roster, STAFF-01), "
               "one dog per groomer and 2 stations (OPS-02), bath first 20 min (SVC-03), customer window.")
    flag = "" if rph >= 60 else "  **Below the $60 target: flag for review.**"
    out.append(f"\nRevenue: ${price} over {(b - a) / 60:.2f} h = ${rph:.0f}/groomer hour (`MATCH-03`).{flag}")
    if paw_balm_eligible(r, d, a, minutes_from_snapshot(d, a)):
        out.append("\nQualifies for complimentary paw balm (`OFFER-01`).")
    others = [f"{DATES[x[0]]} {hm(x[2])} ({x[1]})" for x in slots[1:4]]
    if others: out.append("\nOther valid options: " + ", ".join(others))
    if r.staff is None and "Jamie" in text and not any(x[1] == "Jamie" for x in slots[:1]):
        pass
    out.append(f"\n*Draft reply (needs customer to accept quote, BOOK-01):* \"Hi! We can fit {name} in on {DATES[d]} at {hm(a)} "
               f"with {s} for a {SERVICE_NAMES[r.service].lower()}, ${price}. Want us to lock it in?\"")

def workshop(out):
    out.append("\n---\n# Workshop test prompts\n")
    out.append("**Who's rostered Thursday at 10:30, and what can each do?**")
    for s, (a, b) in ROSTER["Thu"].items():
        if t(a) <= t("10:30") < t(b):
            busy = [x for x in CALENDAR if x.day == "Thu" and x.staff == s and x.start <= t("10:30") < x.end]
            state = f"busy with {busy[0].dog} until {hm(busy[0].end)}" if busy else "free"
            cap = {"Alex": "all sizes, complex coats, approved anxious dogs",
                   "Jamie": "up to 25 kg, standard clips and deshedding, no reactive dogs",
                   "Sam": "bath & brush and nail trims only, up to 15 kg"}[s]
            out.append(f"- {s} ({a}–{b}): {cap}. At 10:30: {state}.")
    olive = ENQUIRIES[4][2]
    ok, end, fails = check_slot(olive, "Thu", "Jamie", t("13:00"))
    out.append(f"\n**Can Olive go with Jamie, Thu 13:00?** {'Yes' if ok else 'No'}.")
    for a, b in fails: out.append(f"- `{a}` {b}")
    alt = [x for x in find_slots(olive) if x[1] == "Jamie"][:1]
    if alt: out.append(f"- Earliest with Jamie instead: Thu {hm(alt[0][2])}–{hm(alt[0][3])}.")
    out.append("\n**Paw balm offer as of the snapshot (Mon 30 Nov, 10:00)** (`OFFER-01`): the slot must start within 48 hours, "
               "so by Wed 2 Dec 10:00. Only Tue 10:00–14:00 starts and a Wed 10:00 start can qualify.")
    for size, kg in (("small", 8), ("medium", 18), ("large", 30)):
        r = Request("probe", kg, "full_groom", addons=["paw_balm"], days=["Tue", "Wed"])
        hits = [x for x in find_slots(r) if paw_balm_eligible(r, x[0], x[2], minutes_from_snapshot(x[0], x[2]))]
        txt = ", ".join(f"{DATES[d]} {hm(a)} ({s})" for d, s, a, b in hits) or "none"
        out.append(f"- Standard-coat {size} full groom + paw balm: {txt}")
    r = Request("probe", 8, "full_groom", days=["Tue"])
    near = [x for x in find_slots(r) if t("10:00") <= x[2] <= t("14:00")]
    if near:
        d, s, a, b = near[0]
        out.append(f"- Why none: a small full groom *without* the balm fits exactly on {DATES[d]} {hm(a)}–{hm(b)} with {s}, "
                   "but the balm's extra 5 minutes would run into the 12:30 lunch break. The rule says the extra time must fit, so it doesn't qualify.")

if __name__ == "__main__":
    out = ["# Etho agent simulation: Harbour Paws demo week (1–5 Dec 2026)",
           "Synthetic data. Nothing confirmed or sent; every recommendation needs the customer's OK (BOOK-01, MATCH-04)."]
    for name, text, r in ENQUIRIES: handle(name, text, r, out)
    workshop(out)
    report = "\n".join(out)
    print(report)
    if len(sys.argv) > 1: open(sys.argv[1], "w").write(report)
