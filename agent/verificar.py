import sqlite3

conn = sqlite3.connect(r'C:\Users\José\AppData\Roaming\tanstack_start_ts\database.db')
cur = conn.cursor()

# Ver colunas da tabela patients
cur.execute("PRAGMA table_info(patients)")
cols = cur.fetchall()
print("Colunas:", [(c[1], c[2]) for c in cols])

# Ver o dado do paciente
cur.execute("SELECT * FROM patients")
rows = cur.fetchall()
for r in rows:
    print("Dado:", r)

conn.close()