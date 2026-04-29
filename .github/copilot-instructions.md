# Pokyny pro projekt

## Jazyk komunikace

Vždy komunikuj v **češtině**. Všechny odpovědi, vysvětlení, komentáře ke kódu a commit zprávy piš česky.

## Verzování a commit workflow

Po dokončení každé ucelené změny proveď následující kroky:

1. **Zvyš verzi** v `pxt.json` — inkrementuj patch verzi (např. `1.2.0` → `1.2.1`). Při větších změnách zvyš minor nebo major verzi dle rozsahu.
2. **Commitni** všechny změněné soubory s výstižnou českou commit zprávou popisující provedenou změnu.
3. **Pushni** commit na GitHub (`git push origin`).

Příklad workflow:
```bash
# Po úpravě kódu:
# 1. Uprav verzi v pxt.json
# 2. git add -A
# 3. git commit -m "Popis změny"
# 4. git push origin
```

### Pravidla pro verzování

- **Patch** (x.y.Z): opravy chyb, drobné úpravy
- **Minor** (x.Y.0): nová funkčnost, zpětně kompatibilní změny
- **Major** (X.0.0): breaking changes, zásadní přepracování
