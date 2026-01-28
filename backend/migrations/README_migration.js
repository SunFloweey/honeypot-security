/**
 * Migration Script: Add response_body column to logs table
 * 
 * IMPORTANTE: Esegui questo script manualmente dal tuo client PostgreSQL
 * 
 * Opzioni per eseguire la migrazione:
 * 1. pgAdmin: Apri Query Tool e incolla il comando SQL sottostante
 * 2. DBeaver: Connettiti al database honeypot ed esegui lo script
 * 3. Docker: docker exec -it <container_id> psql -U postgres -d honeypot
 * 
 * Comando SQL:
 */
/*
--Add the response_body column to logs table
ALTER TABLE logs 
ADD COLUMN IF NOT EXISTS response_body TEXT;

--Verify the migration
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'logs' AND column_name = 'response_body';
*/
/**
 * Output atteso:
 * column_name   | data_type | is_nullable
 * --------------|-----------|-------------
 * response_body | text      | YES
 * 
 * Se la colonna esiste già, il comando non darà errore grazie a "IF NOT EXISTS".
 */
