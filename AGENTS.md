# FDTD project guidance

## Carbon y diseño

- Esta aplicación usa la versión instalada de `@carbon/react`.
- Para cambios de interfaz, compara primero con el componente equivalente del Storybook y la documentación oficial de Carbon.
- Usa Carbon cuando sea adecuado para la interacción, pero no lo fuerces si produce una composición poco clara.
- No consideres correcto un resultado solo porque utilice Carbon o compile sin errores.
- Antes de modificar estilos internos de Carbon, revisa sus props, el contenedor, el espacio disponible y la composición.
- Se permiten estilos de producto que mejoren jerarquía, proporción, legibilidad y uso científico sin romper accesibilidad.

## Camino rápido por defecto

- Atiende una familia concreta de problemas por iteración y evita auditorías generales no solicitadas.
- Para un cambio localizado, inspecciona solo la implementación relevante, el estado afectado y una resolución representativa adicional.
- Entrega primero una iteración visible y comprobable; amplía el trabajo solo si el resultado o el riesgo lo justifican.
- No ejecutes suites completas, matrices extensas, benchmarks ni validaciones científicas para ajustes visuales localizados.
- Si el diagnóstico empieza a crecer sin una causa clara, informa pronto de lo comprobado y acuerda el siguiente paso antes de ampliar el alcance.

## Verificación visual

- Para tareas visuales o de interacción, usa `$browser:control-in-app-browser` cuando esté disponible.
- Inspecciona la pantalla renderizada antes y después del cambio.
- Cuando el origen visual no esté claro, crea primero una reproducción aislada y compárala con la implementación oficial.
- Compara directamente con las capturas, referencias y observaciones proporcionadas por el usuario.
- Comprueba claro y oscuro cuando el cambio afecte colores, capas, contraste o tokens.
- Ejecuta una matriz completa de resoluciones solo cuando se solicite o el cambio afecte al layout general.
- No declares resuelto un problema visual basándote únicamente en TypeScript, tests o inspección estática.

## Alcance

- No conviertas un ajuste visual localizado en una auditoría científica, arquitectónica o general.
- Mantén separadas la validez física del simulador y la calidad visual salvo que el cambio afecte a ambas.
- Muestra y valida un patrón antes de propagarlo al resto de la aplicación.
- Prioriza cambios pequeños, visibles, reversibles y centrados en la causa.
