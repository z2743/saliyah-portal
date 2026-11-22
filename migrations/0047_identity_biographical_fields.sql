ALTER TABLE document_applications ADD COLUMN birth_place TEXT;
ALTER TABLE document_applications ADD COLUMN gender TEXT CHECK(gender IN ('male','female'));
ALTER TABLE document_applications ADD COLUMN father_name TEXT;
ALTER TABLE document_applications ADD COLUMN mother_name TEXT;
ALTER TABLE documents ADD COLUMN birth_place TEXT;
ALTER TABLE documents ADD COLUMN gender TEXT CHECK(gender IN ('male','female'));
ALTER TABLE documents ADD COLUMN father_name TEXT;
ALTER TABLE documents ADD COLUMN mother_name TEXT;
