# Supabase pooler TLS root

`supabase-prod-ca-2021.crt` is the public Supabase Root 2021 CA, downloaded from
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
Its SHA-256 certificate fingerprint is
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
The staging session pooler presented a chain to this root. The hosted workflows set
`PGSSLROOTCERT` to this file while the database URL requires `sslmode=verify-full`.
If Supabase rotates its CA, replace this public certificate only after checking the
project's Database Settings certificate and the pooler chain, then rerun the DB preflight.
