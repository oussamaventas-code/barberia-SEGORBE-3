
# PROYECTO: CLUB SEGORBE OS
## Sistema digital integral de barbería — Murcia, España

Actúa como un equipo senior compuesto por:
- Director creativo especializado en productos digitales premium.
- Product Designer UX/UI.
- Arquitecto de software.
- Desarrollador Full Stack senior.
- Especialista en bases de datos.
- Especialista en seguridad y protección de datos.
- Especialista en CRM y automatización de negocios.

Tu misión es diseñar, desarrollar e implementar CLUB SEGORBE OS: un software privado y exclusivo para gestionar digitalmente la barbería Club Segorbe, ubicada en Murcia, España.

NO construyas una simple landing page.
NO construyas una demo de pantallas estáticas.
NO construyas un calendario desconectado de una base de datos.

Construye una aplicación web completa, funcional, responsive y preparada para producción.

El sistema tendrá tres áreas conectadas:

1. WEB PÚBLICA.
2. SISTEMA DE RESERVAS PARA CLIENTES.
3. PANEL PRIVADO DE ADMINISTRACIÓN Y CRM.

Todas deben compartir la misma fuente de datos y funcionar como un único producto.

==================================================
01. IDENTIDAD Y DIRECCIÓN CREATIVA
==================================================

MARCA:
CLUB SEGORBE

CONCEPTO:
Barbería contemporánea. Estilo, precisión, personalidad y atención personal.

UBICACIÓN:
Murcia, España.

DIRECCIÓN ESTÉTICA:
BRUTALIST SIGNAL.

IDENTIDAD VISUAL:

La interfaz debe combinar:
- Brutalismo editorial.
- Estética urbana.
- Fotografía cinematográfica de barbería.
- Tipografía de gran personalidad.
- Contrastes contundentes.
- Composiciones asimétricas.
- Elementos gráficos geométricos.
- Una experiencia de producto digital premium.

PALETA OBLIGATORIA:

Papel: #E8E4DD
Rojo señal: #E63B2E
Blanco roto: #F5F3EE
Negro: #111111

Usos:
- Fondos principales: papel y blanco roto.
- Textos principales: negro.
- Botones principales: rojo señal.
- Elementos destacados: rojo señal.
- Panel administrativo: negro, papel y superficies neutras.
- Estados de error: rojo.
- Estados correctos: verde discreto.
- Estados pendientes: ámbar.

TIPOGRAFÍAS:

- Encabezados: Space Grotesk.
- Titulares editoriales: DM Serif Display Italic.
- Datos, códigos, horarios y etiquetas: Space Mono.

Cargar las fuentes desde Google Fonts.

IDENTIDAD FOTOGRÁFICA:

Fotografía realista de:
- Barberos profesionales.
- Primeros planos de cortes masculinos.
- Herramientas de barbería.
- Tijeras, máquinas y navajas.
- Texturas de metal, hormigón y cuero.
- Interiores de barberías contemporáneas.

Usar imágenes reales de Unsplash, con URLs válidas.
No utilizar fotografías genéricas de oficinas o tecnología.
No utilizar imágenes de personas que parezcan artificiales.

La imagen protagonista debe ser un barbero profesional trabajando, con iluminación cinematográfica, contraste elevado y una estética editorial.

==================================================
02. ARQUITECTURA GENERAL
==================================================

Crear una aplicación con tres zonas diferenciadas:

A. ZONA PÚBLICA
Ruta inicial: /

B. ZONA DE RESERVAS
Ruta: /reservar

C. ZONA PRIVADA
Ruta: /admin

Añadir las rutas necesarias para:
- /mi-cita
- /mis-citas
- /admin/agenda
- /admin/clientes
- /admin/servicios
- /admin/equipo
- /admin/configuracion
- /admin/informes

La navegación debe estar correctamente protegida.

Un visitante nunca debe poder acceder al CRM sin autenticación.

La zona pública no debe mostrar enlaces innecesarios al panel administrativo.

ARQUITECTURA TÉCNICA:

Preferencia de implementación:
- React 19.
- Tailwind CSS 3.4.17.
- GSAP 3.
- GSAP ScrollTrigger.
- Lucide React.
- Backend real.
- PostgreSQL como base de datos.
- Supabase como infraestructura preferente para PostgreSQL, autenticación, almacenamiento y funciones backend.

Si la plataforma de desarrollo elegida ofrece una infraestructura nativa más adecuada, utilizarla siempre que permita cumplir todas las garantías de seguridad, persistencia y concurrencia especificadas.

No implementar una base de datos simulada mediante localStorage.

No guardar información crítica exclusivamente en el navegador.

Todas las operaciones críticas deben ejecutarse y validarse en el servidor.

Separar:
- Interfaz.
- Lógica de negocio.
- Acceso a datos.
- Autenticación.
- Autorización.
- Integraciones externas.

La aplicación debe tener una arquitectura mantenible, documentada y preparada para desplegarse en un dominio propio.

==================================================
03. WEB PÚBLICA — HOME
==================================================

La página inicial debe ser visualmente impactante, pero extremadamente sencilla.

No queremos una web corporativa tradicional llena de secciones innecesarias.

HERO PRINCIPAL H1 — STATEMENT ÉPICO.

Altura: 100dvh.

Imagen full-bleed de un barbero profesional trabajando.

Imagen:
Fotografía cinematográfica, barbería contemporánea, iluminación dramática, tonos oscuros y composición editorial.

Aplicar:
- Overlay oscuro progresivo.
- Gradiente para mejorar legibilidad.
- Textura de ruido SVG con opacidad 0.05.
- Animación de entrada con GSAP.

NAVBAR:

Barra flotante centrada horizontalmente.
Fondo inicialmente transparente.
Al hacer scroll, aplicar fondo con blur y borde sutil.

Contenido:
- CLUB SEGORBE.
- Servicios.
- Pedir cita.

No añadir enlaces innecesarios.

COPY DEL HERO:

Etiqueta superior:
MURCIA · BARBERÍA

Titular:
DEFINE EL

ESTILO.

La primera línea en Space Grotesk Bold.
La segunda en DM Serif Display Italic, de gran tamaño.

Subtítulo:
Tu próximo corte empieza aquí.

CTA PRINCIPAL:
PEDIR CITA →

El botón debe llevar directamente a /reservar.

Texto secundario:
Reserva online · Sin llamadas · Desde cualquier dispositivo.

Añadir una indicación discreta de desplazamiento.

El diseño móvil debe conservar el impacto visual sin perder legibilidad.

Debajo del hero, incorporar una sección compacta de servicios:

- Corte de pelo.
- Arreglo de barba.
- Corte + barba.

Los precios y duraciones deben proceder de la base de datos. No inventar cantidades.

CTA FINAL:
RESERVA TU PRÓXIMA CITA.

FOOTER:
Club Segorbe.
Murcia.
Contacto configurable.
Privacidad.
Aviso legal.
Política de cancelación.

No inventar dirección postal, teléfono, redes sociales ni datos fiscales.

==================================================
04. SISTEMA DE RESERVAS
==================================================

Esta es una de las partes más importantes del proyecto.

Debe ser un sistema real de reservas, no un formulario que envía información sin controlar disponibilidad.

Diseñar un proceso intuitivo de cinco pasos.

PASO 1 — SERVICIO

Mostrar tarjetas visuales de servicios.

Cada tarjeta contiene:
- Nombre.
- Descripción.
- Precio.
- Duración.
- Imagen o icono.
- Disponibilidad.

Servicios iniciales propuestos:
- Corte de pelo.
- Arreglo de barba.
- Corte + barba.

Estos servicios son configurables y deben poder modificarse desde administración.

No inventar precios ni duraciones.

Permitir que el administrador cree, edite, desactive y elimine servicios, respetando las reservas históricas.

PASO 2 — PROFESIONAL

Mostrar los profesionales disponibles.

Cada profesional debe tener:
- Nombre.
- Fotografía opcional.
- Especialidades.
- Servicios que realiza.
- Horario laboral.
- Días libres.
- Excepciones de disponibilidad.

Si solamente existe un profesional activo, seleccionarlo automáticamente y ocultar el paso para simplificar el proceso.

Si hay varios, permitir elegir uno o seleccionar primera disponibilidad disponible.

PASO 3 — FECHA Y HORA

Mostrar un calendario interactivo.

Características:
- Navegación entre semanas y meses.
- Días disponibles claramente identificados.
- Días no disponibles desactivados.
- Horarios disponibles en botones.
- Actualización en tiempo real desde backend.
- Adaptación perfecta a móvil.

El calendario debe consultar la disponibilidad real.

No mostrar horarios ficticios.

No permitir reservas fuera del horario laboral.

No permitir solapamientos.

No permitir reservas en días festivos o vacaciones configuradas.

Calcular correctamente los horarios en Europe/Madrid, incluyendo cambios de horario de verano e invierno.

PASO 4 — DATOS DEL CLIENTE

Solicitar exclusivamente:

- Nombre y apellidos.
- Teléfono.
- Correo electrónico, opcional si no resulta necesario para la confirmación elegida.

Permitir que un cliente habitual pueda identificarse y recuperar sus datos, sin obligar a todos los visitantes a crear una cuenta.

Consentimientos:
- Aceptación de la política de privacidad.
- Consentimiento comercial separado y opcional.

No marcar automáticamente el consentimiento comercial.

PASO 5 — CONFIRMACIÓN

Mostrar un resumen:

- Servicio.
- Profesional.
- Fecha.
- Hora.
- Duración.
- Precio.
- Datos del cliente.

Botón:
CONFIRMAR RESERVA.

Al confirmar:
1. Validar nuevamente la disponibilidad en el servidor.
2. Comprobar que no existe otra reserva ocupando el intervalo.
3. Crear la reserva en una transacción segura.
4. Guardar la información en la base de datos.
5. Generar un identificador único.
6. Mostrar la confirmación.
7. Enviar notificación si la integración está configurada.

Pantalla final:

CITA CONFIRMADA.

Mostrar fecha, hora, servicio y profesional.

Ofrecer:
- Añadir al calendario.
- Consultar mi cita.
- Modificar cita.
- Cancelar cita.

==================================================
05. ÁREA DEL CLIENTE
==================================================

Crear una zona sencilla donde el cliente pueda gestionar sus citas.

El acceso puede realizarse mediante enlace seguro enviado por correo electrónico o mediante verificación del teléfono, según las integraciones configuradas.

No exponer citas de otros clientes.

FUNCIONES:

1. Consultar cita.
2. Cambiar fecha y hora.
3. Cambiar profesional cuando sea compatible.
4. Cancelar cita.
5. Consultar reservas anteriores.
6. Volver a reservar un servicio habitual.

Las modificaciones deben comprobar nuevamente la disponibilidad real.

No permitir que una reserva ya cancelada vuelva a considerarse activa.

Configurar desde administración:
- Antelación mínima para reservar.
- Antelación máxima.
- Tiempo límite para cancelar.
- Tiempo límite para modificar.
- Tiempo de margen entre citas.

Crear estados:
- Pendiente.
- Confirmada.
- Completada.
- Cancelada.
- No presentado.

No utilizar cambios de estado únicamente visuales: persistirlos en backend.

==================================================
06. PANEL DE ADMINISTRACIÓN — CLUB SEGORBE OS
==================================================

Diseñar un dashboard profesional, con personalidad visual y navegación intuitiva.

Debe ser una herramienta de trabajo diaria.

El administrador debe comprender el estado de su barbería en menos de cinco segundos.

SIDEBAR:

- Overview.
- Agenda.
- Reservas.
- Clientes.
- Servicios.
- Equipo.
- CRM.
- Informes.
- Configuración.

CABECERA:

- CLUB SEGORBE OS.
- Fecha actual.
- Buscador.
- Notificaciones.
- Perfil del administrador.

OVERVIEW:

Mostrar tarjetas KPI alimentadas por datos reales:

- Citas de hoy.
- Citas pendientes.
- Clientes nuevos.
- Clientes habituales.
- Cancelaciones.
- Ocupación.
- Ingresos registrados.

No inventar métricas ni mostrar números de ejemplo como si fueran datos reales.

Si todavía no existen datos, mostrar estados vacíos informativos.

Gráficos:
- Evolución de reservas.
- Distribución de servicios.
- Ocupación por día.
- Rendimiento por profesional.

Filtros por fecha.

Los ingresos deben calcularse exclusivamente a partir de información real de servicios completados y registros económicos disponibles.

No considerar automáticamente una reserva como una venta cobrada.

==================================================
07. AGENDA INTELIGENTE
==================================================

La agenda es el centro operativo de la barbería.

Diseñar vistas:

- Día.
- Semana.
- Mes.

Mostrar las citas mediante bloques visuales.

Cada bloque debe contener:
- Nombre del cliente.
- Servicio.
- Profesional.
- Hora.
- Duración.
- Estado.

Permitir:
- Crear cita manualmente.
- Editar cita.
- Cancelar cita.
- Reprogramar.
- Marcar como completada.
- Marcar como no presentado.
- Bloquear franjas horarias.
- Registrar descansos y vacaciones.

Implementar vista por profesional.

Permitir crear una reserva desde el propio calendario.

Al crear o modificar una cita manualmente, validar disponibilidad desde el backend.

Añadir filtros por:
- Profesional.
- Servicio.
- Estado.
- Fecha.

Evitar que las operaciones visuales de arrastrar y soltar permitan crear conflictos.

==================================================
08. CRM — FICHA 360° DEL CLIENTE
==================================================

Construir un CRM integrado con todas las reservas.

Cada cliente debe tener una ficha individual.

DATOS:

- Nombre.
- Teléfono.
- Correo electrónico.
- Fecha de alta.
- Última visita.
- Próxima cita.
- Número de visitas.
- Servicios utilizados.
- Importe histórico registrado.
- Preferencias.
- Notas internas.
- Estado de relación.

HISTORIAL:

Mostrar una línea temporal de:
- Reservas.
- Servicios.
- Cancelaciones.
- Ausencias.
- Visitas completadas.
- Cambios de cita.
- Comunicaciones registradas.

SEGMENTACIÓN AUTOMÁTICA:

Crear segmentos configurables:

- Clientes nuevos.
- Clientes habituales.
- Clientes inactivos.
- Clientes frecuentes.
- Clientes con citas próximas.
- Clientes con cancelaciones recurrentes.

El sistema debe poder identificar clientes que llevan más tiempo del habitual sin visitar la barbería.

La periodicidad debe ser configurable y calcularse a partir del historial real.

No etiquetar a un cliente como perdido sin datos suficientes.

ACCIONES:

- Abrir ficha.
- Crear reserva.
- Consultar historial.
- Añadir nota.
- Registrar incidencia.
- Registrar preferencia.
- Consultar comunicaciones.

IMPORTANTE:

Las notas internas deben ser privadas y nunca visibles para el cliente.

==================================================
09. CRM INTELIGENTE Y AUTOMATIZACIONES
==================================================

Preparar un motor de automatizaciones.

AUTOMATIZACIÓN 1 — RECORDATORIO DE CITA

Enviar un recordatorio configurable antes de la reserva.

AUTOMATIZACIÓN 2 — CONFIRMACIÓN

Confirmar automáticamente las reservas cuando se creen correctamente.

AUTOMATIZACIÓN 3 — CANCELACIÓN

Registrar la cancelación y liberar el horario.

AUTOMATIZACIÓN 4 — CLIENTE INACTIVO

Identificar clientes que superan el intervalo habitual entre visitas.

Permitir generar campañas de recuperación.

AUTOMATIZACIÓN 5 — LISTA DE ESPERA

Crear lista de espera para servicios y franjas horarias.

Cuando se libera una cita:
- Identificar clientes compatibles.
- Registrar la oportunidad.
- Ofrecer el hueco según una política configurable.

No confirmar automáticamente una reserva de lista de espera sin aceptación del cliente.

CANALES:

Preparar integraciones para:
- Correo electrónico.
- SMS.
- WhatsApp Business.

No simular envíos.

Si no existe configuración de un proveedor, mostrar la integración como pendiente.

Respetar consentimiento, preferencias de comunicación y normativa aplicable.

==================================================
10. GESTIÓN DE SERVICIOS Y PROFESIONALES
==================================================

SERVICIOS:

Crear un módulo administrativo para:

- Añadir servicios.
- Editar nombres.
- Descripciones.
- Precios.
- Duraciones.
- Imágenes.
- Activar y desactivar.
- Asignar profesionales.

PROFESIONALES:

Permitir:

- Crear perfiles.
- Editar perfiles.
- Activar y desactivar.
- Configurar horarios.
- Gestionar descansos.
- Gestionar vacaciones.
- Asignar servicios.
- Consultar agenda individual.

El sistema debe admitir varios profesionales aunque inicialmente se configure uno solo.

==================================================
11. BASE DE DATOS Y MODELO DE INFORMACIÓN
==================================================

Crear una base de datos relacional.

Tablas principales:

1. profiles
Usuarios autenticados y roles.

2. customers
Clientes de la barbería.

3. staff
Profesionales.

4. services
Catálogo de servicios.

5. staff_services
Relación entre profesionales y servicios.

6. business_settings
Configuración general del negocio.

7. working_hours
Horarios habituales.

8. staff_availability
Disponibilidad y excepciones.

9. appointments
Reservas.

10. appointment_services
Servicios asociados a cada cita.

11. appointment_events
Historial de modificaciones.

12. blocked_slots
Bloqueos de agenda.

13. customer_notes
Notas privadas.

14. waitlist
Lista de espera.

15. notifications
Notificaciones y estado de entrega.

16. communication_consents
Consentimientos y preferencias.

17. payments
Registros de pagos cuando se habilite esta función.

18. audit_logs
Registro de acciones administrativas relevantes.

RELACIONES:

- Un cliente puede tener muchas citas.
- Un profesional puede tener muchas citas.
- Una cita pertenece a un profesional.
- Una cita puede contener uno o varios servicios.
- Un servicio puede estar asignado a varios profesionales.
- Un cliente puede tener múltiples notas e interacciones.

Crear claves primarias, claves foráneas, índices y restricciones.

Guardar precios y duraciones como valores históricos en cada reserva para que los cambios futuros del catálogo no alteren citas anteriores.

Guardar fechas en UTC y presentar los horarios en Europe/Madrid.

Usar identificadores seguros y no exponer claves internas innecesariamente.

==================================================
12. SEGURIDAD Y CONCURRENCIA
==================================================

ESTA SECCIÓN ES CRÍTICA.

Implementar:

- Autenticación segura.
- Roles y permisos.
- Protección de rutas privadas.
- Validación backend.
- Políticas de acceso a datos.
- Protección frente a inyección.
- Protección frente a abuso de endpoints.
- Gestión segura de sesiones.
- Variables de entorno.
- Registro de errores.
- Auditoría de acciones relevantes.

ROLES:

ADMIN:
Acceso completo.

STAFF:
Acceso limitado a las funciones autorizadas.

CUSTOMER:
Acceso exclusivamente a sus propias reservas y datos permitidos.

No permitir que el frontend decida por sí solo los permisos.

Aplicar políticas RLS cuando se utilice Supabase.

Nunca colocar claves privadas o service role keys en el frontend.

CONCURRENCIA:

La creación de citas debe ser atómica.

Dos clientes no pueden reservar el mismo horario simultáneamente.

Implementar una estrategia de bloqueo o restricción transaccional en PostgreSQL para evitar solapamientos.

Considerar la duración real del servicio y los márgenes configurados.

No basta con consultar disponibilidad desde el frontend: volver a validarla al guardar.

Si dos solicitudes compiten por el mismo hueco, una debe confirmarse y la otra recibir un mensaje claro de disponibilidad agotada.

Añadir protección de idempotencia para evitar duplicados por doble clic o reintentos.

==================================================
13. PROTECCIÓN DE DATOS Y NORMATIVA
==================================================

La aplicación se utilizará en España.

Preparar el sistema para cumplir con las obligaciones aplicables de:

- RGPD.
- LOPDGDD.
- Información de privacidad.
- Gestión de consentimientos.
- Derechos de acceso.
- Rectificación.
- Supresión cuando corresponda.
- Exportación de datos.
- Limitación de conservación.
- Protección de datos personales.

Implementar separación entre:
- Datos necesarios para gestionar reservas.
- Consentimiento comercial.
- Preferencias de comunicación.

No utilizar los datos de clientes para marketing sin la base jurídica y los consentimientos que correspondan.

No guardar datos personales innecesarios.

Incluir páginas preparadas para:
- Política de privacidad.
- Política de cookies.
- Aviso legal.
- Condiciones de reserva y cancelación.

No inventar datos fiscales ni información legal de la empresa. Dejar esos contenidos pendientes de configuración y revisión profesional.

==================================================
14. NOTIFICACIONES
==================================================

Crear un centro de notificaciones administrativo.

Eventos:
- Nueva reserva.
- Modificación.
- Cancelación.
- Cita próxima.
- Nuevo cliente.
- Hueco liberado.
- Error en envío de notificación.

Permitir configurar canales.

Registrar:
- Tipo.
- Destinatario.
- Fecha.
- Estado.
- Proveedor.
- Error si existe.

No mostrar como enviada una notificación que el proveedor no haya confirmado.

==================================================
15. DISEÑO DE INTERFAZ Y COMPONENTES
==================================================

Aplicar un sistema visual consistente.

TEXTURA GLOBAL:

Overlay de ruido SVG mediante feTurbulence.
Opacidad: 0.05.

RADIOS:

rounded-[2rem] a rounded-[3rem] para contenedores principales.

MICROINTERACCIONES:

- Hover de botones: scale(1.03).
- Curva: cubic-bezier(0.25, 0.46, 0.45, 0.94).
- Capa deslizante para transición de color.
- Elementos interactivos: translateY(-1px).

ANIMACIONES:

Utilizar GSAP 3 y ScrollTrigger donde aporte valor.

Entradas: power3.out.
Morphs: power2.inOut.
Stagger de texto: 0.08.
Stagger de tarjetas: 0.15.

En React:
- Usar gsap.context() dentro de useEffect.
- Ejecutar ctx.revert() en cleanup.
- Evitar animaciones duplicadas.
- Respetar prefers-reduced-motion.

COMPONENTES VISUALES SELECCIONADOS:

A. HERO H1 — STATEMENT ÉPICO.

Imagen full-bleed, texto editorial y CTA dominante.

B. FEATURE F3 — CALENDARIO CURSOR.

Mostrar una pequeña representación interactiva del proceso de reserva:
- Cuadrícula semanal.
- Cursor animado.
- Selección de día.
- Selección de hora.
- Confirmación visual.

No debe simular una reserva real en la landing. Es una representación visual del producto.

C. FEATURE F6 — NOTIFICACIÓN STACK.

Mostrar notificaciones de ejemplo claramente identificadas como demostración visual:
- Nueva reserva.
- Cita confirmada.
- Horario liberado.

D. FEATURE F9 — COMPARADOR DE COLUMNAS.

Dos columnas:

Sin Club Segorbe OS:
- Agenda dispersa.
- Reservas manuales.
- Información fragmentada.
- Seguimiento difícil.

Con Club Segorbe OS:
- Agenda centralizada.
- Reservas organizadas.
- Clientes en una ficha.
- Gestión desde un solo lugar.

E. SOCIAL PROOF SP4 — MÉTRICAS ANIMADAS.

Utilizar únicamente métricas reales procedentes de la base de datos.

Mientras no haya información suficiente, mostrar indicadores funcionales sin cifras inventadas.

F. PROCESO P2 — TIMELINE HORIZONTAL.

Tres pasos:
1. Elige tu servicio.
2. Reserva tu horario.
3. Disfruta tu visita.

En móvil, convertir en timeline vertical.

G. FAQ.

Preguntas frecuentes:
- ¿Cómo puedo pedir cita?
- ¿Puedo cambiar mi reserva?
- ¿Puedo cancelar?
- ¿Qué servicios ofrece la barbería?
- ¿Necesito crear una cuenta?

H. CTA3 — CTA ÚNICO GRANDE.

Titular:
TU PRÓXIMO CORTE TE ESPERA.

Botón:
PEDIR CITA.

FOOTER:

Fondo oscuro profundo.
Nombre Club Segorbe.
Navegación.
Privacidad.
Aviso legal.
Indicador de sistema activo únicamente si el backend confirma su estado.

==================================================
16. RESPONSIVE DESIGN
==================================================

Diseño mobile-first.

El cliente debe poder completar una reserva cómodamente desde un teléfono.

Prioridades móviles:
- Botones grandes.
- Calendario fácil de utilizar.
- Campos accesibles.
- Pocos pasos.
- Sin tablas horizontales.
- Navegación sencilla.
- Confirmación clara.

En escritorio:
- Dashboard con sidebar.
- Calendario amplio.
- Tablas legibles.
- Filtros avanzados.
- Gráficos y métricas.

Comprobar tamaños:
- Móvil pequeño.
- Móvil grande.
- Tablet.
- Portátil.
- Escritorio.

==================================================
17. CONFIGURACIÓN INICIAL DEL NEGOCIO
==================================================

Crear un asistente de configuración inicial.

El propietario debe poder completar:

- Nombre comercial.
- Dirección.
- Teléfono.
- Email.
- Horario.
- Días de apertura.
- Festivos.
- Servicios.
- Precios.
- Duraciones.
- Profesionales.
- Políticas de cancelación.
- Antelación mínima y máxima de reservas.
- Márgenes entre citas.
- Canales de notificación.

No asumir información que no se haya facilitado.

No inventar:
- Dirección exacta.
- Teléfono.
- Nombre de barberos.
- Horarios.
- Precios.
- Duraciones.
- Facturación.
- Estadísticas.

Si falta información, mostrar una configuración pendiente.

La aplicación debe poder arrancar en un estado inicial sin datos falsos.

==================================================
18. CALIDAD, PRUEBAS Y PUESTA EN PRODUCCIÓN
==================================================

Antes de considerar terminado el proyecto, ejecutar pruebas de:

RESERVAS:
- Reserva correcta.
- Reserva fuera de horario.
- Reserva duplicada.
- Reserva simultánea.
- Modificación.
- Cancelación.
- Reprogramación.

CLIENTES:
- Alta.
- Consulta.
- Historial.
- Privacidad.
- Acceso no autorizado.

ADMINISTRACIÓN:
- Inicio de sesión.
- Permisos.
- Crear servicios.
- Modificar horarios.
- Bloquear agenda.
- Consultar métricas.

SEGURIDAD:
- Acceso a rutas protegidas.
- Acceso a datos de otros clientes.
- Validaciones del servidor.
- Exposición de secretos.
- Protección de operaciones sensibles.

CALIDAD:
- Sin errores de consola.
- Sin enlaces rotos.
- Sin botones decorativos que aparenten funcionar.
- Sin formularios que no guarden datos.
- Sin información ficticia presentada como real.
- Sin datos de demostración en producción.

Preparar:
- Gestión de errores.
- Logs.
- Copias de seguridad.
- Migraciones de base de datos.
- Entorno de desarrollo.
- Entorno de producción.
- Variables de entorno.
- Documentación de despliegue.
- Plan de recuperación.

No afirmar que la aplicación está preparada para producción si las integraciones, las políticas de seguridad o las pruebas críticas están pendientes.

==================================================
19. ORDEN DE EJECUCIÓN
==================================================

Trabaja en este orden:

FASE 1:
Arquitectura, estructura y diseño visual.

FASE 2:
Base de datos, autenticación y permisos.

FASE 3:
Web pública y experiencia de reservas.

FASE 4:
Agenda y panel administrativo.

FASE 5:
CRM y fichas de clientes.

FASE 6:
Automatizaciones y notificaciones.

FASE 7:
Pruebas de funcionamiento, seguridad y responsive.

FASE 8:
Documentación y preparación para despliegue.

No te detengas después de crear una maqueta visual.

Implementa las operaciones reales.

Si necesitas credenciales externas, solicita únicamente las necesarias y explica dónde configurarlas.

No inventes claves ni simules conexiones.

Si alguna función depende de un servicio externo no configurado, deja preparada la integración y comunica claramente qué falta para activarla.

==================================================
20. DIRECTIVA FINAL DE EJECUCIÓN
==================================================

No construyas un sitio web; construye un instrumento digital.

Cada scroll debe sentirse intencional, cada animación debe sentirse con peso y profesional.

Erradica todos los patrones genéricos de IA.

Cada sección debe tener su propia personalidad visual manteniendo coherencia con el sistema de diseño.

La web pública debe transmitir personalidad.

La reserva debe ser rápida.

La agenda debe ser fiable.

El CRM debe ser útil.

La administración debe ser sencilla.

El propietario debe poder controlar su barbería desde un solo lugar.

El cliente debe poder reservar sin complicaciones.

El backend debe ser la fuente de verdad.

La seguridad y la integridad de las reservas tienen prioridad sobre cualquier efecto visual.

RESULTADO FINAL:

CLUB SEGORBE OS.

Un sistema digital exclusivo, profesional, elegante, funcional y preparado para convertirse en el centro de operaciones de la barbería.
