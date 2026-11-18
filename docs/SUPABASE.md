# Configurar Amigos con Supabase

Amigos es **opcional**. Si no haces estos pasos, la app sigue funcionando 100 % en tu navegador y la pestaña Amigos ofrece **Probar con datos de ejemplo**: un backend en memoria con amigos, invitaciones y fechas ficticias, sin ninguna petición de red. Solo si quieres usar amigos reales necesitas Supabase.

## 1. Crear el proyecto

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y crea un proyecto nuevo.
2. Espera a que termine de aprovisionarse. Guarda la contraseña de la base de datos en un lugar seguro (no la necesita la app).
3. En **Authentication → Providers**, revisa que **Email** esté habilitado.

## 2. Ejecutar el esquema

1. En el proyecto, abre **SQL Editor → New query**.
2. Pega todo el contenido de `supabase/schema.sql`.
3. Presiona **Run**. El script se puede volver a ejecutar: usa `create table if not exists` y `drop policy if exists`.

Eso crea las cinco tablas de Amigos (`profiles`, `friendships`, `shared_events`, `study_sessions`, `session_invites`), las dos opcionales nuevas (`usage_events` y `feedback`), activa RLS en todas, crea los helpers y RPCs y deja la vista `usage_events_weekly`. Verifica en **Table Editor** que las tablas aparezcan y que RLS esté activo.

## 3. Plantilla de correo con código de 6 dígitos

La app usa OTP con código, no enlace mágico, para evitar problemas de redirección en la PWA instalada.

1. Ve a **Authentication → Email Templates → Confirm signup** (y también **Magic Link** si Supabase la usa para el OTP de ese proyecto).
2. En el cuerpo del correo incluye el token explícitamente, por ejemplo:

```html
<h2>Tu código para entrar</h2>
<p>Tu código de 6 dígitos es: <strong>{{ .Token }}</strong></p>
<p>Si no fuiste tú, ignora este correo.</p>
```

3. Guarda el cambio. Comprueba que el correo llegue con el código visible.

Si Supabase te devuelve un enlace en vez de `token` en `/auth/v1/verify`, revisa que la plantilla incluya `{{ .Token }}` y que el proveedor Email esté configurado para OTP por código.

## 4. Copiar la URL y la anon key

1. En **Project Settings → API**, copia **Project URL** y **anon public** key.
2. Abre `js/config.js` y completa:

```js
const SUPABASE_URL='https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY='TU_ANON_KEY_PUBLICA';
```

3. Sube el archivo junto con el resto de la app. El service worker ya incluye `config.js` y `social.js` en su caché.

La **anon key es pública por diseño**: cualquiera que tenga la app puede verla. La seguridad no depende de secretos en el frontend, sino de las políticas **RLS** de `schema.sql` y de los RPCs `SECURITY DEFINER`. Nunca pongas la *service_role* key en el frontend.

## 5. Cómo se usa

1. Entra a **Amigos** e inicia sesión con tu correo. Escribe el código de 6 dígitos del correo.
2. La primera vez se pide el nombre visible (se propone el de tu perfil local) y se crea tu perfil con un código de amigo aleatorio de 8 letras.
3. Comparte tu código o ingresa el de otra persona. Las solicitudes pendientes se aceptan o rechazan desde la misma pestaña.
4. Para invitar a una sesión, crea la sesión con fecha, horario, ramo, lugar o enlace y nota, y marca a tus amigos.
5. Para compartir fechas, activa el interruptor **Compartir las fechas de este ramo con mis amigos**. Solo se sincronizan título, tipo, fecha y nombre del ramo. Las fechas que importes de un amigo guardan su origen y no se reenvían.

## Métricas de uso y comentarios

Ambas funciones son opcionales y están **apagadas por defecto** en **Ajustes → Privacidad**.

- Al activar las estadísticas se genera un `anon_id` aleatorio (`crypto.randomUUID`) que no se liga a `auth.users`, al correo ni al correo institucional. El intervalo entre envíos es de un día: se manda un único lote a `usage_events` con `anon_id`, `evento`, `seccion` (solo en `seccion_vista` y `modo_elegido`), `dia` (sin hora), `university`, `career` (solo si están llenos) y `app_version`.
- Lista blanca de eventos: `app_abierta`, `seccion_vista`, `pomodoro_completado`, `flashcards_repasadas`, `certamen_activado`, `ics_importado`, `syllabus_importado`, `notas_calculadas`, `amigo_agregado`, `modo_elegido`. Cualquier otro evento se descarta en el cliente y la tabla vuelve a validarlo con un `check`.
- Al desactivar las estadísticas se borran el ID y la cola pendiente. Sin Supabase configurado o sin red no se envía nada y la app no muestra errores.
- Los comentarios se envían desde el mismo apartado a `feedback` con `dia`, `tipo` (`idea`, `problema`, `otro`), `mensaje` (≤ 1000 caracteres), `university`, `career` y `app_version`. Sin Supabase, el botón **Copiar comentario** lo deja en el portapapeles.
- `usage_events` y `feedback` permiten `insert` a `anon` y `authenticated`; `select` solo a `service_role`. La vista `usage_events_weekly` agrega por semana, evento y universidad con `count(distinct anon_id)` como `usuarios_unicos`, y tampoco se expone a `anon`/`authenticated`.

## Privacidad

Si usas Amigos, se envían a Supabase: nombre visible, código de amigo, relaciones de amistad, fechas de los ramos que marques como compartidos y sesiones de estudio. Si activas estadísticas o envías un comentario, se añaden solo los campos enumerados arriba.

**Nunca** se envían check-ins, energía, ánimo, sueño, diario, notas personales ni calificaciones: no hay tablas para esos datos en el esquema y el cliente no los incluye en ningún cuerpo de petición. La universidad y la carrera son opcionales; «Prefiero no decir» no se envía.

Para borrar todo lo que sí está en el servidor, usa **Amigos → Eliminar mi cuenta y mis datos del servidor**. Eso llama al RPC `delete_my_account()` y borra perfil, amistades, fechas, sesiones e invitaciones por cascada. No afecta tus datos locales ni tu respaldo JSON, ni borra los eventos anónimos: para dejar de compartirlos, desactiva el interruptor en **Ajustes → Privacidad**.

La Ley 21.719 de protección de datos personales de Chile aplica a lo que se guarda en el servidor si activas Amigos, las estadísticas o los comentarios. Esto no es asesoría legal.

## Pruebas

`npm test` ejecuta `social.test.js` y `metrics.test.js` con un Supabase simulado por `page.route()`: no necesitas un proyecto real ni credenciales para correr las pruebas.
