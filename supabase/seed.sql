-- STEP 8: Import the 22 seed requests from data/seed-requests.csv.
-- Generated from the CSV (not hand-typed). ids 1-22 follow file order,
-- matching the ids the app assigned in Steps 2-6.

insert into public.requests
  (id, created_at, requester_name, location, description, priority, status)
values
  (1, '2026-07-16T14:20:00Z', 'Dana Whitfield', 'Minneapolis', 'HVAC making noise in suite 400', 'High', 'Complete'),
  (2, '2026-07-17T16:05:00Z', 'Marcus Ellery', 'Chicago', 'Replace lobby badge printer', 'Medium', 'Complete'),
  (3, '2026-07-20T13:38:00Z', 'Priya Raghunathan', 'Denver', 'Standing desk request — new hire starts Aug 3', 'Medium', 'Complete'),
  (4, '2026-07-22T18:47:00Z', 'Tomas Beckley', 'Austin', 'Conference room B projector will not connect to laptops', 'High', 'Complete'),
  (5, '2026-07-24T15:11:00Z', 'Alison Vo', 'Minneapolis', 'Schedule quarterly fire-safety inspection', 'Medium', 'Complete'),
  (6, '2026-07-27T21:02:00Z', 'Devon Ruiz', 'Chicago', 'Water leak under the breakroom sink, floor 6', 'Urgent', 'Complete'),
  (7, '2026-07-29T14:55:00Z', 'Hannah Sorensen', 'Denver', 'Order two ergonomic chairs for the finance team', 'Low', 'Complete'),
  (8, '2026-07-31T17:26:00Z', 'Curtis Nakamura', 'Austin', 'Badge access not working for the fourth floor stairwell', 'High', 'Complete'),
  (9, '2026-08-03T13:15:00Z', 'Renata Oyelaran', 'Minneapolis', 'Coffee machine in the north kitchen keeps shutting off', 'Low', 'Complete'),
  (10, '2026-08-04T19:40:00Z', 'Grant Pemberton', 'Chicago', 'Move six workstations from 12A to 12C before Friday', 'Medium', 'Complete'),
  (11, '2026-08-06T14:08:00Z', 'Sofia Marchetti', 'Denver', 'Elevator 2 stopped between floors, riders freed by building staff', 'Urgent', 'Complete'),
  (12, '2026-08-07T16:33:00Z', 'Isaac Fontaine', 'Austin', 'Restock the first aid cabinets on all three floors', 'Low', 'Complete'),
  (13, '2026-08-10T15:47:00Z', 'Dana Whitfield', 'Minneapolis', 'Replace burned out lights above the reception desk', 'Low', 'Complete'),
  (14, '2026-08-12T13:52:00Z', 'Marcus Ellery', 'Chicago', 'Quote needed for repainting the 8th floor corridor', 'Medium', 'In Progress'),
  (15, '2026-08-14T20:19:00Z', 'Priya Raghunathan', 'Denver', 'Server room temperature alarm went off twice overnight', 'Urgent', 'In Progress'),
  (16, '2026-08-17T14:41:00Z', 'Tomas Beckley', 'Austin', 'Set up two extra monitors in the training room', 'Medium', 'In Progress'),
  (17, '2026-08-19T18:07:00Z', 'Nadia Kowalski', 'Minneapolis', 'Loading dock door closes only halfway', 'High', 'In Progress'),
  (18, '2026-08-21T15:24:00Z', 'Curtis Nakamura', 'Austin', 'Add visitor parking signage at the south entrance', 'Low', 'In Progress'),
  (19, '2026-08-24T13:36:00Z', 'Renata Oyelaran', 'Minneapolis', 'Quarterly deep clean for the client meeting suites', 'Medium', 'In Progress'),
  (20, '2026-08-26T16:58:00Z', 'Grant Pemberton', 'Chicago', 'Front entrance card reader is slow to respond, sometimes needs three taps', 'High', 'New'),
  (21, '2026-08-27T14:12:00Z', 'Sofia Marchetti', 'Denver', 'Request a second recycling pickup each week', 'Low', 'New'),
  (22, '2026-08-28T17:45:00Z', 'Alison Vo', 'Minneapolis', 'Air conditioning in suite 220 is not cooling, staff moved to the open area', 'Urgent', 'New');

-- Move the id counter past the imported rows so the next new request gets id 23.
select setval(pg_get_serial_sequence('public.requests', 'id'),
              (select max(id) from public.requests));
