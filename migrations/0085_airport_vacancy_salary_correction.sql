-- Royal review: realistic indicative monthly-equivalent aviation salary ranges for the 14 airport vacancies.
-- Salary amounts are virtual Saliyah riyals. Keep any future individually negotiated higher salary.
UPDATE vacancies SET salary=CASE id
 WHEN 'airport-job-20261126-01' THEN MAX(salary,19000)
 WHEN 'airport-job-20261126-02' THEN MAX(salary,7500)
 WHEN 'airport-job-20261126-03' THEN MAX(salary,9000)
 WHEN 'airport-job-20261126-04' THEN MAX(salary,8000)
 WHEN 'airport-job-20261126-05' THEN MAX(salary,12000)
 WHEN 'airport-job-20261126-06' THEN MAX(salary,6000)
 WHEN 'airport-job-20261126-07' THEN MAX(salary,32000)
 WHEN 'airport-job-20261126-08' THEN MAX(salary,9000)
 WHEN 'airport-job-20261126-09' THEN MAX(salary,7500)
 WHEN 'airport-job-20261126-10' THEN MAX(salary,7500)
 WHEN 'airport-job-20261126-11' THEN MAX(salary,11000)
 WHEN 'airport-job-20261126-12' THEN MAX(salary,7000)
 WHEN 'airport-job-20261126-13' THEN MAX(salary,6500)
 WHEN 'airport-job-20261126-14' THEN MAX(salary,6500)
 ELSE salary END
WHERE id LIKE 'airport-job-20261126-%';
