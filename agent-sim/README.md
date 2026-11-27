# Etho agent simulation (synthetic Harbour Paws data)

- `engine.py`: the business rules from *Etho_Demo_Week_Calendar.pdf* as code. It checks one proposed slot (`check_slot`) or finds every valid slot (`find_slots`), and cites rule IDs for each pass or fail.
- `run_demo.py`: the simulated agent. For each enquiry: eligibility -> quote -> slot search -> revenue check -> offer check -> draft reply. Never confirms or sends anything.
- `report.md`: output of `python3 run_demo.py report.md`.

To test a new enquiry, add a `Request(...)` to `ENQUIRIES` in `run_demo.py` and run it again.
