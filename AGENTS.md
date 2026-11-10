

<!-- repo-forge:agents:inicio -->
# AGENTS.md — instrucciones para agentes

Cualquier agente que toque **OpenDesign** debe:

1. Leer `BIBLIA.md` y `plataforma/FICHA.md` antes de escribir.
2. Ejecutar `python scripts/doctor.py` al empezar y al terminar.
3. Respetar el techo de alcance: no añadir módulos que la ficha no describa.
4. No borrar archivos, no reescribir historia, no hacer push sin pedido explícito.
5. Declarar en el informe qué se ejecutó y qué no; lo no ejecutado no se afirma.

## Comandos seguros

| Comando | Efecto |
|---|---|
| `python scripts/doctor.py` | Solo lectura; devuelve el estado de reglas |
| `python -m unittest discover -s tests` | Pruebas locales |

<!-- repo-forge:agents -->
<!-- repo-forge:agents:fin -->
