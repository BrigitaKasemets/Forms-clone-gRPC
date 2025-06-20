# gRPC Vormide API

Vormide halduse teenus, mis kasutab **gRPC** tehnoloogiat. Võimaldab luua ja hallata vorme, küsimusi, vastuseid ning kasutajate autentimist.

## Kiire alustamine (Quick Start)

Quick-start skript käivitab nüüd mõlemad serverid (gRPC + REST) ühekorraga!

```bash
# Klooni repositoorium
git clone https://github.com/BrigitaKasemets/Forms-clone-gRPC.git
cd Forms-clone-gRPC

# Installi kõik dependencyd ja käivita mõlemad serverid
npm run quick-start
```


## 💡 Kiirkäsud

### 🎯 Peamised käsud:
```bash
npm run quick-start  # 🚀 KÕIK ÜHES: clean + setup + start mõlemad serverid
npm run status      # 📊 Kontrolli serverite seisundit
npm stop            # � Peata kõik serverid
```

### 🔧 Arenduseks:
```bash
npm start           # Käivita ainult gRPC server
npm run dev         # gRPC server nodemon'iga (automaatne restart)
npm run client      # Testi gRPC ühendust
```

### 🧪 Testimiseks:
```bash
npm run test-client     # gRPC testid  
npm run test           # REST vs gRPC võrdlustestid
npm run test:grpc-only # Sama mis test-client
```

### 🗄️ Andmebaasi haldus:
```bash
npm run init-db    # Lähtesta andmebaas
npm run clean      # Kustuta kõik (node_modules, DB, logs)
```

## 📋 Detailne kasutusjuhend

### 🔧 Serveri käivitamine

#### Mõlemad serverid (gRPC + REST):
```bash
npm run quick-start    # Kõige lihtsam - teeb kõike automaatselt
```

#### Ainult gRPC server:
```bash
npm start             # Otsene käivitamine
npm run dev           # Arendusrežiim (nodemon)
```

#### Serverite kontroll:
```bash
npm run status        # Näita kõigi serverite seisundit
npm stop             # Peata kõik serverid
```

### 🧪 Testimine

#### gRPC API testimine:
```bash
npm run client          # Põhiline gRPC kliendi demonstratsioon  
npm run test-client     # Täielikud gRPC testid (24/24 testi möödub!)
npm run test:grpc-only  # Sama mis test-client
```

#### REST vs gRPC võrdlustestid:

See projekt sisaldab unikaalset funktsionaalsust, mis võrdleb REST ja gRPC API implementatsioone:

```bash
# Käivita täielikud võrdlustestid
npm run test
```

**MÄRKUS:** Võrdlustestide jaoks peavad mõlemad serverid töötama:
- **gRPC server** - port 50051 (`npm run quick-start` käivitab automaatselt)
- **REST server** - port 3000 (`npm run quick-start` käivitab automaatselt)

### 🗄️ Andmebaasi haldus

```bash
npm run init-db       # Lähtesta/loo SQLite andmebaas
npm run clean         # Eemalda kõik (node_modules, DBs, logs)
```

### 📊 Monitooring

```bash
npm run status        # Detailne serverite seisund:
                     # - Protsesside info (PID, mälu, käivitusaeg)
                     # - Portide kontroll
                     # - Andmebaasi seisund  
                     # - Logifailide info
```

## 🏗️ Projekti struktuur

```
Forms-clone-gRPC/
├── src/              # gRPC serveri kood
├── REST-api/         # REST API serveri kood  
├── proto/            # Protocol Buffer definitsioonid
├── client/           # gRPC kliendi näited
├── scripts/          # Automatiseeritud skriptid
├── tests/            # Testid ja võrdlused
└── logs/             # Serverite logid
```

## 🚀 Skriptide ülevaade

| Skript | Kirjeldus |
|--------|-----------|
| `npm run quick-start` | **PEAMINE** - Clean install + mõlemad serverid |
| `npm start` | Käivita ainult gRPC server |
| `npm run dev` | gRPC server nodemon'iga |
| `npm stop` | Peata kõik serverid |
| `npm run status` | Kontrolli serverite seisundit |
| `npm run client` | Testi gRPC ühendust |
| `npm run test-client` | gRPC API testid |
| `npm run test` | REST vs gRPC võrdlustestid |
| `npm run init-db` | Lähtesta andmebaas |
| `npm run clean` | Kustuta kõik failid (clean install) |
