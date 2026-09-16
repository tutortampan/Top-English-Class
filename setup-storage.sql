-- ============================================================
-- STORAGE: student-photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-photos', 'student-photos', true) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read student-photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'student-photos');

CREATE POLICY "Auth Insert/Update student-photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'student-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Update student-photos" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'student-photos' AND auth.role() = 'authenticated');
