"""Etho booking-check engine for the Harbour Paws demo week (synthetic data).

Encodes the rules in Etho_Demo_Week_Calendar.pdf. Every check returns the rule
IDs it relied on, so an agent can cite them. Times are minutes from midnight.
"""
from dataclasses import dataclass, field

SNAPSHOT = ("Mon", 10 * 60)          # WEEK-01: Monday 30 Nov 2026, 10:00
DAYS = ["Tue", "Wed", "Thu", "Fri", "Sat"]
DAY_INDEX = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5}
DATES = {"Tue": "Tue 1 Dec", "Wed": "Wed 2 Dec", "Thu": "Thu 3 Dec", "Fri": "Fri 4 Dec", "Sat": "Sat 5 Dec"}
BUFFER = 15                           # OPS-02
BATH_MIN = 20                         # SVC-03
LUNCH = (12 * 60 + 30, 13 * 60)       # STAFF-01
STATIONS = 2                          # OPS-02
STEP = 15                             # candidate start times every 15 min

def t(s):  # "13:30" -> 810
    h, m = s.split(":"); return int(h) * 60 + int(m)
def hm(m):
    return f"{m // 60:02d}:{m % 60:02d}"

# WEEK roster (section 1)
ROSTER = {
    "Tue": {"Alex": ("08:00", "17:00"), "Jamie": ("09:00", "16:00")},
    "Wed": {"Alex": ("08:00", "17:00"), "Jamie": ("09:00", "16:00")},
    "Thu": {"Alex": ("08:00", "16:00"), "Jamie": ("10:00", "16:00"), "Sam": ("09:00", "15:00")},
    "Fri": {"Alex": ("09:00", "17:00"), "Jamie": ("09:00", "15:00"), "Sam": ("10:00", "15:00")},
    "Sat": {"Alex": ("09:00", "15:00"), "Sam": ("09:00", "15:00")},
}

# SVC-01 durations (min) and prices (AUD)
SERVICES = {
    "bath_brush": {"small": (45, 55), "medium": (60, 75), "large": (90, 100)},
    "full_groom": {"small": (90, 95), "medium": (120, 130), "large": (150, 170)},
    "deshedding": {"small": (60, 80), "medium": (90, 110), "large": (120, 145)},
    "nail_trim":  {"small": (15, 20), "medium": (15, 20), "large": (20, 25)},
}
SERVICE_NAMES = {"bath_brush": "Bath & brush", "full_groom": "Full groom", "deshedding": "Deshedding", "nail_trim": "Nail trim"}
ADDONS = {"teeth": (10, 15), "paw_balm": (5, 10), "conditioning": (15, 20)}

def size_of(kg):  # DOG-01
    if kg <= 10: return "small"
    if kg <= 25: return "medium"
    if kg <= 40: return "large"
    return "xl"

@dataclass
class Booking:
    day: str; staff: str; start: int; end: int; dog: str; kg: float; service: str
    anxious: bool = False
    @property
    def uses_bath(self): return self.service != "nail_trim"

def B(day, staff, a, b, dog, kg, svc):
    return Booking(day, staff, t(a), t(b), dog, kg, svc)

# Section 3: confirmed bookings (occupied interval includes cleaning buffer)
CALENDAR = [
    B("Tue","Alex","08:00","10:45","Max",32,"full_groom"),   B("Tue","Jamie","09:00","10:45","Bella",8,"full_groom"),
    B("Tue","Alex","13:00","14:45","Rocky",30,"bath_brush"), B("Tue","Jamie","14:00","15:15","Coco",14,"bath_brush"),
    B("Wed","Alex","11:00","12:15","Finn",18,"bath_brush"),  B("Wed","Jamie","09:00","10:15","Pip",12,"bath_brush"),
    B("Wed","Jamie","13:00","14:45","Teddy",9,"full_groom"), B("Wed","Alex","14:00","16:15","Bear",34,"deshedding"),
    B("Thu","Alex","08:00","10:45","Duke",31,"full_groom"),  B("Thu","Sam","09:00","10:00","Ollie",7,"bath_brush"),
    B("Thu","Jamie","10:45","12:30","Nala",8,"full_groom"),  B("Thu","Sam","13:00","14:15","Peach",12,"bath_brush"),
    B("Thu","Alex","13:30","15:45","Scout",33,"deshedding"), B("Fri","Jamie","09:00","10:45","Loki",17,"deshedding"),
    B("Fri","Alex","09:30","12:15","Hugo",29,"full_groom"),  B("Fri","Sam","10:45","11:45","Bean",6,"bath_brush"),
    B("Fri","Alex","13:00","14:45","Blue",32,"bath_brush"),  B("Sat","Alex","09:00","11:45","Moose",35,"full_groom"),
    B("Sat","Sam","09:30","10:30","Poppy",8,"bath_brush"),   B("Sat","Sam","13:00","14:15","Rosie",13,"bath_brush"),
]

@dataclass
class Request:
    dog: str
    kg: float | None
    service: str
    coat: str = "standard"            # standard | curly | dense
    matting: str = "none"             # none | moderate | severe | unknown
    anxious: bool = False
    anxious_approved: bool = False
    reactive: bool = False
    bite_history: bool = False
    contagious: bool = False
    age_weeks: int | None = None
    new_customer: bool = False
    vaccinated: bool | None = True
    opted_in: bool = False
    manager_approved_xl: bool = False
    addons: list = field(default_factory=list)
    oral_pain: bool = False
    days: list = field(default_factory=lambda: list(DAYS))
    earliest: dict = field(default_factory=dict)   # day -> "HH:MM" earliest start
    finish_by: dict = field(default_factory=dict)  # day -> "HH:MM" latest end (incl. buffer)
    staff: str | None = None          # requested staff member

# ---------------------------------------------------------------- eligibility
def eligibility(r: Request):
    """Hard stops that need a human before any slot is offered (DOG-02, DOG-01, SVC-02, DATA-01)."""
    issues = []
    if r.kg is None: issues.append(("DATA-01", "Weight is missing, so size, duration and price can't be set."))
    elif r.kg > 40 and not r.manager_approved_xl:
        issues.append(("DOG-01", f"{r.kg:g} kg is over 40 kg and manager approval isn't recorded."))
    if r.new_customer and r.vaccinated is not True:
        issues.append(("DOG-02", "New customer without vaccination confirmation."))
    if r.vaccinated is None and not r.new_customer:
        issues.append(("DATA-01", "Vaccination status unknown."))
    if r.age_weeks is not None and r.age_weeks < 16: issues.append(("DOG-02", "Puppy under 16 weeks."))
    if r.contagious: issues.append(("DOG-02", "Suspected contagious illness."))
    if r.bite_history: issues.append(("DOG-02", "Known bite history."))
    if r.matting == "severe": issues.append(("SVC-02", "Severe matting needs an in-person assessment before any quote."))
    if r.matting == "unknown" and r.service == "full_groom":
        issues.append(("SVC-02", "Coat condition unknown; don't assume it from breed."))
    if r.anxious and not r.anxious_approved: issues.append(("DOG-03", "Anxious dog without prior approval."))
    return issues

def quote(r: Request):
    """Service minutes, price and the rule IDs used (SVC-01, SVC-02, add-ons)."""
    size = size_of(r.kg)
    mins, price = SERVICES[r.service][size if size != "xl" else "large"]
    rules = ["SVC-01"]; lines = [f"{SERVICE_NAMES[r.service]} ({size}) {mins} min ${price}"]
    if r.service == "full_groom" and r.coat in ("curly", "dense"):
        mins += 30; price += 25; rules.append("SVC-02"); lines.append("Curly/dense coat +30 min +$25")
    if r.matting == "moderate":
        mins += 30; price += 35; rules.append("SVC-02"); lines.append("Moderate matting +30 min +$35 (staff to confirm)")
    for a in r.addons:
        if a == "teeth" and r.oral_pain:
            lines.append("Teeth brushing removed: known oral pain (OFFER-02)"); rules.append("OFFER-02"); continue
        m, p = ADDONS[a]; mins += m; price += p; lines.append(f"{a.replace('_', ' ').title()} +{m} min +${p}")
    return mins, price, rules, lines

def staff_ok(name, r: Request):
    """STAFF table + STAFF-01 + DOG-03. Returns (ok, reason)."""
    complex_coat = r.coat in ("curly", "dense") or r.matting == "moderate"
    if r.anxious and name != "Alex": return False, "Anxious dogs must be with Alex (DOG-03)"
    if r.kg > 25 and name != "Alex": return False, "Only Alex handles dogs over 25 kg (STAFF-01)"
    if name == "Jamie":
        if r.reactive: return False, "Jamie can't take reactive dogs"
        if complex_coat and r.service == "full_groom":
            return False, "Jamie does standard clips; curly/dense or matted coats go to Alex (staff table)"
    if name == "Sam":
        if r.service not in ("bath_brush", "nail_trim"): return False, "Sam does bath & brush and nail trims only"
        if r.kg > 15: return False, "Sam handles dogs up to 15 kg"
        if r.addons: return False, "Add-ons not listed as Sam's capability"
    return True, ""

def overlaps(a1, a2, b1, b2): return a1 < b2 and b1 < a2

# ------------------------------------------------------------------- checker
def check_slot(r: Request, day, staff, start, calendar=CALENDAR, service_minutes=None):
    """Check one proposed slot. Returns (ok, occupied_end, list of (rule, message))."""
    mins = service_minutes if service_minutes is not None else quote(r)[0]
    end = start + mins + BUFFER
    fails = []
    if day not in ROSTER: return False, end, [("OPS-01", f"Closed on {day}")]
    shift = ROSTER[day].get(staff)
    if not shift: return False, end, [("WEEK roster", f"{staff} isn't rostered on {day}")]
    ok, why = staff_ok(staff, r)
    if not ok: fails.append(("STAFF", why))
    s0, s1 = t(shift[0]), t(shift[1])
    if start < s0 or end > s1: fails.append(("WEEK roster", f"{hm(start)}–{hm(end)} is outside {staff}'s shift {shift[0]}–{shift[1]}"))
    if overlaps(start, end, *LUNCH): fails.append(("STAFF-01", f"{hm(start)}–{hm(end)} overlaps lunch 12:30–13:00"))
    if day in r.days:
        if day in r.earliest and start < t(r.earliest[day]): fails.append(("Customer", f"Customer can't start before {r.earliest[day]}"))
        if day in r.finish_by and end > t(r.finish_by[day]): fails.append(("Customer", f"Must finish by {r.finish_by[day]}"))
    else:
        fails.append(("Customer", f"Customer isn't available on {day}"))
    if r.staff and r.staff != staff: fails.append(("Customer", f"Customer asked for {r.staff}"))
    day_cal = [b for b in calendar if b.day == day]
    for b in day_cal:
        if b.staff == staff and overlaps(start, end, b.start, b.end):
            fails.append(("OPS-02", f"{staff} is with {b.dog} {hm(b.start)}–{hm(b.end)}")); break
    # stations: at no minute may more than 2 dogs be on a station
    for m in range(start, end):
        busy = [b for b in day_cal if b.start <= m < b.end]
        if len(busy) + 1 > STATIONS:
            names = ", ".join(f"{b.dog} ({b.staff} {hm(b.start)}–{hm(b.end)})" for b in busy)
            fails.append(("OPS-02", f"Both stations taken at {hm(m)}: {names}")); break
    if r.service != "nail_trim":
        bath = (start, start + BATH_MIN)
        for b in day_cal:
            if b.uses_bath and overlaps(*bath, b.start, b.start + BATH_MIN):
                fails.append(("SVC-03", f"Bath clash: {b.dog} has the bath {hm(b.start)}–{hm(b.start + BATH_MIN)}")); break
    if r.anxious:
        if day == "Sat": fails.append(("DOG-03", "Anxious dogs need a weekday appointment"))
        if end > t("11:00"): fails.append(("DOG-03", f"Quiet appointment must be before 11:00 (this one runs to {hm(end)})"))
        others = [b for b in day_cal if overlaps(start, end, b.start, b.end)]
        if others: fails.append(("DOG-03", "Another dog is in the salon: " + ", ".join(f"{b.dog} {hm(b.start)}–{hm(b.end)}" for b in others)))
    for b in day_cal:  # don't break into an existing anxious dog's quiet time
        if b.anxious and overlaps(start, end, b.start, b.end): fails.append(("DOG-03", f"{b.dog} needs the salon quiet"))
    # dedupe while keeping order
    seen, out = set(), []
    for f in fails:
        if f not in seen: seen.add(f); out.append(f)
    return (not out), end, out

def find_slots(r: Request, calendar=CALENDAR, days=None):
    """All valid (day, staff, start, end) for a request, earliest first."""
    mins = quote(r)[0]
    found = []
    for day in (days or r.days):
        for staff in ROSTER.get(day, {}):
            s0, s1 = map(t, ROSTER[day][staff])
            for start in range(s0, s1, STEP):
                ok, end, _ = check_slot(r, day, staff, start, calendar, mins)
                if ok: found.append((day, staff, start, end))
    found.sort(key=lambda x: (DAY_INDEX[x[0]], x[2], x[1]))
    return found

def revenue_per_hour(price, start, end):  # MATCH-03
    return price / ((end - start) / 60)

def paw_balm_eligible(r: Request, day, start, minutes_from_snapshot):
    """OFFER-01: Tue–Thu, full groom, start 10:00–14:00, slot starts within 48 h of the snapshot."""
    return (r.service == "full_groom" and day in ("Tue", "Wed", "Thu")
            and t("10:00") <= start <= t("14:00") and minutes_from_snapshot <= 48 * 60)

def minutes_from_snapshot(day, start):
    return (DAY_INDEX[day] - DAY_INDEX[SNAPSHOT[0]]) * 24 * 60 + start - SNAPSHOT[1]
