# FDTD project guidance

## Carbon y diseño

- Esta aplicación usa la versión instalada de `@carbon/react`.
- Consulta Storybook o la documentación oficial cuando introduzcas un componente, exista una duda de comportamiento o sea necesario sobrescribir estilos internos; no repitas esa comparación para reutilizaciones evidentes.
- Usa Carbon cuando sea adecuado para la interacción, pero no lo fuerces si produce una composición poco clara.
- No consideres correcto un resultado solo porque utilice Carbon o compile sin errores.
- Antes de modificar estilos internos de Carbon, revisa sus props, el contenedor, el espacio disponible y la composición.
- Se permiten estilos de producto que mejoren jerarquía, proporción, legibilidad y uso científico sin romper accesibilidad.

## Propiedad de la interfaz

- React es el único propietario de la estructura, visibilidad, atributos ARIA, estado visual y eventos de los componentes que renderiza.
- El runtime no debe guardar referencias permanentes ni modificar directamente nodos renderizados por React.
- Comunica runtime → React mediante el store o eventos `fdtd:*`, y React → runtime mediante la API de acciones.
- No combines listeners imperativos y handlers React sobre el mismo control.

## `scientific-ui`

- Corrige por defecto los problemas específicos dentro de FDTD.
- Modifica `scientific-ui` solo cuando la causa pertenezca al componente compartido y se pretenda propagar la corrección a sus consumidores.
- Al actualizar el paquete vendorizado, cambia conjuntamente `package.json`, `pnpm-lock.yaml` y el tarball, y comprueba que el nuevo `.tgz` quede rastreado por Git.

## Camino rápido por defecto

- Atiende una familia concreta de problemas por iteración y evita auditorías generales no solicitadas.
- Para un cambio localizado, inspecciona solo la implementación relevante, el estado afectado y una resolución representativa adicional.
- Entrega primero una iteración visible y comprobable; amplía el trabajo solo si el resultado o el riesgo lo justifican.
- No ejecutes suites completas, matrices extensas, benchmarks ni validaciones científicas para ajustes visuales localizados.
- Si el diagnóstico empieza a crecer sin una causa clara, informa pronto de lo comprobado y acuerda el siguiente paso antes de ampliar el alcance.

## Subagentes

- Usa subagentes `gpt-5.6-luna` con razonamiento `max` en paralelo cuando la tarea pueda dividirse en partes independientes y la delegación mejore claramente la velocidad, la cobertura o la calidad.
- Asigna a cada subagente un alcance concreto y sin solapamientos; el agente principal conserva la integración y la verificación final.
- Evita que varios subagentes editen simultáneamente el mismo archivo.
- El agente principal debe revisar el diff y verificar el estado integrado; no basta con aceptar las comprobaciones declaradas por los subagentes.
- No uses subagentes para cambios pequeños, secuenciales o fuertemente acoplados cuando la coordinación cueste más que resolverlos directamente.

## Verificación

- Para tareas visuales o de interacción, usa `$browser:control-in-app-browser` cuando esté disponible.
- Inspecciona la pantalla renderizada antes y después del cambio.
- Cuando el origen visual no esté claro, crea primero una reproducción aislada y compárala con la implementación oficial.
- Compara directamente con las capturas, referencias y observaciones proporcionadas por el usuario.
- Comprueba claro y oscuro cuando el cambio afecte colores, capas, contraste o tokens.
- Ejecuta una matriz completa de resoluciones solo cuando se solicite o el cambio afecte al layout general.
- No declares resuelto un problema visual basándote únicamente en TypeScript, tests o inspección estática.
- Cambio visual localizado: navegador interno y resolución afectada.
- Cambio responsive: escritorio y un viewport representativo del breakpoint.
- Cambio React/TypeScript: `pnpm typecheck` y el flujo afectado.
- Cambio de runtime: `pnpm validate:runtime`.
- Migración amplia: typecheck, arquitectura, build y los casos de navegador relevantes.
- Reutiliza el servidor local y HMR durante la iteración; ejecuta el build final cuando el cambio esté integrado o antes de publicarlo.
- Mantén separadas la validez física del simulador y la calidad visual salvo que el cambio afecte a ambas.
