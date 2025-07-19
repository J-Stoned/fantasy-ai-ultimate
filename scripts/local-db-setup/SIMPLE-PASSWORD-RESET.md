# 🔐 Simple PostgreSQL Password Reset

If you forgot your PostgreSQL password, here's the easiest way to reset it:

## Option 1: Reinstall PostgreSQL (Simplest)
1. Uninstall PostgreSQL from Windows "Add or Remove Programs"
2. Reinstall it
3. Set password to: **postgres**
4. Come back and run our copy scripts!

## Option 2: Use pgAdmin (If you have it)
1. Open pgAdmin (installed with PostgreSQL)
2. It might remember your password
3. Look in File → Preferences → Browser → Master Password

## Option 3: Edit pg_hba.conf (Advanced)
1. Go to: `C:\Program Files\PostgreSQL\17\data\`
2. Find file: `pg_hba.conf`
3. Open in Notepad as Administrator
4. Change all lines that say `md5` or `scram-sha-256` to `trust`
5. Save the file
6. Restart PostgreSQL service
7. Connect without password and reset it:
   ```
   psql -U postgres -p 5434
   ALTER USER postgres PASSWORD 'newpassword';
   ```
8. Change `trust` back to `md5` in pg_hba.conf
9. Restart PostgreSQL again

## Option 4: Common Passwords to Try
Did you maybe use one of these?
- Your Windows password
- Password123
- Postgres123
- Admin123
- Your name + 123
- 12345678

## 🎯 Recommendation:
**Just reinstall PostgreSQL** - it's the fastest way and only takes 5 minutes!