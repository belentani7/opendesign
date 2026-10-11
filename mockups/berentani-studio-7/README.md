# Berentani Studio 7 — Laboratorio "Glass Rojo Neón"

Una aplicación de interfaz completa, **100 % offline**: sin APIs, sin red, sin coste.
Todo el arte (vidrio esmerilado, neón rojo, tipografía de laboratorio) está recreado con
CSS y JS del sistema — nada se descarga. Abrir `index.html` y basta.

## Qué es

Un laboratorio nocturno encerrado en vidrio: portada con el hexágono "B" de neón, y una
sala de instrumentos con rack de módulos (Mezclador, Espectro, Cámara de Pruebas,
Archivo 7, Configuración del Sello), mesa de trabajo con medidores de aguja, osciloscopio
de neón y faders con estela, barra de transporte (iniciar / pausar / registrar / sellar) y
una consola de cristal que escribe con luz.

## Capacidades

- **Mezclador**: cuatro tubos-fader con estela luminosa; dos medidores circulares con aguja.
- **Espectro**: osciloscopio de neón que dibuja la suma de los tubos en vivo.
- **Cámara de Pruebas**: registra "ecos" con marca de tiempo.
- **Archivo 7**: sella mezclas en `localStorage`; nada sale de la máquina.
- **Configuración del Sello**: intensidad del neón, densidad de partículas y parpadeo de
  tubos, persistidos.
- **Modo invitado**: "Observar como invitado" permite mirar sin actuar.

## Movimiento

Los paneles caen con rebote, los hover encienden bordes en 300 ms, los clics producen un
pulso radial rojo, las cargas son tubos que se llenan de luz, el éxito recorre el borde del
panel, y un tubo decorativo parpadea de vez en cuando. Todo respeta
`prefers-reduced-motion`.

## Responsive

Escritorio: rack + mesa + consola como tres vitrinas. Tableta: la consola se pliega bajo la
mesa. Móvil: columna de paneles con el rack convertido en barra inferior de iconos de neón.

## Nota

Recreado desde cero a partir de la especificación de diseño "Glass Rojo Neón"; no depende
de ningún material externo ni de ninguna API.
