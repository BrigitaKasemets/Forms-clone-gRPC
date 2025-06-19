# gRPC Vormide API

##  Installeerimine ja Seadistus

### Kiire alustamine (ainult gRPC)
```bash
# Klooni repositoorium
git clone https://github.com/BrigitaKasemets/Forms-clone-gRPC.git
cd Forms-clone-gRPC

# Seadista ainult gRPC projekt
npm run setup
```

### Täielik seadistus (gRPC + REST + jagatud andmebaas)
```bash
# Klooni mõlemad projektid
git clone https://github.com/BrigitaKasemets/Forms-clone-gRPC.git
git clone https://github.com/BrigitaKasemets/forms-clone-api.git FormsCloneApi
cd Forms-clone-gRPC

# Seadista mõlemad projektid + jagatud andmebaas
./dev-helper.sh setup
```

### Käsitsi seadistusi stiilis teenus, mis kasutab **gRPC** tehnoloogiat. Võimaldab luua ja hallata vorme, küsimusi, vastuseid ning kasutajate autentimist.

##  Kiirkäsud

### Ainult gRPC API jaoks:
```bash
npm run setup     # Seadistab ainult gRPC projekti
npm run run       # Käivitab gRPC serveri 
npm run client    # Testib gRPC ühendust
```

### Mõlemad API-d + võrdlustestid:
```bash
./dev-helper.sh setup    # Seadistab gRPC + REST + jagatud andmebaas
./dev-helper.sh start    # Käivitab mõlemad serverid
npm test                 # Käivitab võrdlustestid (15/15 testid ✅)
./dev-helper.sh stop
```

##  Installeerimine ja Seadistus

### Kiire alustamine
```bash
# Klooni repositoorium
git clone https://github.com/BrigitaKasemets/Forms-clone-gRPC.git
cd Forms-clone-gRPC

# Täielik seadistus: paigalda sõltuvused ja lähtesta andmebaas
npm run setup
```

### Käsitsi seadistus
```bash
# Paigalda sõltuvused
npm install

# Lähtesta andmebaas
npm run init-db
```

##  Serveri Käivitamine

### gRPC Server (port 50051)

```bash
# Variant 1: Täielik käivitamine koos kontrollimisega (soovitatud)
npm run run

# Variant 2: Otsene käivitamine
npm start

# Variant 3: Arendusrežiim automaatse taaskäivitamisega
npm run dev
```

Server käivitub vaikimisi **portil 50051**.

### Installatsiooni kontrollimine

```bash
# Testi gRPC ühendust
npm run client
```

##  Testimine

### gRPC API testimine
```bash
npm run client          # Põhiline gRPC kliendi demonstratsioon  
npm run test-client     # Täielikud gRPC testid (24/24 testi möödub!)
npm run test:grpc-only  # Sama mis test-client
```

### REST vs gRPC Võrdlustestid

See projekt sisaldab unikaalset funktsionaalsust, mis võrdleb REST ja gRPC API implementatsioone:

```bash
# Käivita täielikud võrdlustestid
npm test
```
**TÄHTIS: Võrdlustestide eeltingimused:**

1. **REST API peab olema käivitatud portil 3000** 
   - Klooni: [forms-clone-api](https://github.com/BrigitaKasemets/forms-clone-api.git)
   - Käivita: `npm run dev`

2. **gRPC API peab olema käivitatud portil 50051**
   - Käivita selles projektis: `npm run run`

### Andmebaasi haldus
```bash
npm run init-db     # Lähtesta/loo SQLite andmebaas
```

### Projekti haldus
```bash
npm run setup       # Täielik projekti seadistus (sõltuvused + andmebaas)
npm run clean       # Eemalda node_modules, package-lock.json ja andmebaas
```
