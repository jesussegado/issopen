import { z } from "zod";

export const captureErrorCodeSchema = z.enum([
  "busy",
  "no-tab",
  "page-access",
  "unsupported-page",
  "protected-page",
  "page-changed",
  "viewport-changed",
  "content-changed",
  "page-unavailable",
  "page-too-complex",
  "selection-cancelled",
  "full-page-limit",
  "image-too-large",
  "image-too-heavy",
  "capture-failed",
  "extension-unavailable",
]);
export type CaptureErrorCode = z.infer<typeof captureErrorCodeSchema>;
type CaptureProblem = {
  title: string;
  description: string;
  steps: readonly string[];
};
// Static, safe copy only. Browser exceptions can contain credentials or URLs:
// never display them or guess a cause by matching their text.
export const captureProblems: Record<CaptureErrorCode, CaptureProblem> = {
  busy: {
    title: "Ya hay una captura en curso",
    description: "La extensión todavía está preparando la captura anterior.",
    steps: [
      "Termina la selección en la página o pulsa Escape para cancelarla.",
      "Espera a que vuelva a aparecer Capturar página.",
    ],
  },
  "no-tab": {
    title: "No hay una página activa para capturar",
    description: "No hemos encontrado la pestaña que quieres revisar.",
    steps: [
      "Abre la página web en una ventana normal de Chrome.",
      "Pulsa el icono de Issopen en esa pestaña y después Capturar página.",
    ],
  },
  "page-access": {
    title: "No podemos acceder a esta pestaña",
    description:
      "Chrome no ha permitido iniciar la captura en esta página. Estar conectado a Issopen no concede acceso a las páginas del navegador.",
    steps: [
      "Vuelve a la pestaña que quieres capturar.",
      "Pulsa el icono de Issopen en la barra de Chrome (dentro del botón de extensiones con forma de puzle si no lo ves).",
      "Vuelve a pulsar Capturar página. Si persiste, recarga esa página y repite estos pasos.",
    ],
  },
  "unsupported-page": {
    title: "Esta página no admite capturas",
    description:
      "La extensión no captura páginas internas de Chrome, tiendas de extensiones, archivos locales ni ventanas de incógnito.",
    steps: [
      "Abre una página web normal (http o https), fuera de incógnito.",
      "Pulsa el icono de Issopen en esa pestaña para continuar.",
    ],
  },
  "protected-page": {
    title: "Pantalla de acceso protegida",
    description:
      "No capturamos pantallas de inicio de sesión o consentimiento para proteger tus credenciales.",
    steps: [
      "Termina el acceso y abre la página de contenido que quieras revisar.",
    ],
  },
  "page-changed": {
    title: "Has cambiado de página o pestaña",
    description:
      "Detuvimos la captura para no recoger otra página distinta de la que habías elegido.",
    steps: [
      "Vuelve a la página que querías capturar y pulsa el icono de Issopen.",
      "Repite la captura sin cambiar de pestaña ni navegar mientras se prepara.",
    ],
  },
  "viewport-changed": {
    title: "Ha cambiado el tamaño de la página",
    description:
      "La ventana, el panel lateral o el zoom cambiaron durante la captura. El recorte ya no coincidiría con lo que seleccionaste.",
    steps: [
      "Ajusta primero el tamaño de la ventana, el panel y el zoom.",
      "Cuando estén estables, repite la captura sin redimensionarlos.",
    ],
  },
  "content-changed": {
    title: "La página cambió mientras capturábamos",
    description:
      "Detectamos cambios en el contenido. Paramos por seguridad: podrían aparecer datos nuevos que todavía no habíamos ocultado.",
    steps: [
      "Espera a que la página termine de cargar o actualizarse y vuelve a capturar.",
      "Si se actualiza continuamente, pausa esa actualización desde la propia web si es posible. Cambiar a recorte no evita esta protección.",
    ],
  },
  "page-unavailable": {
    title: "La página ya no está disponible para esta captura",
    description:
      "Se perdió el acceso al documento o se agotó el tiempo de preparación.",
    steps: [
      "Espera a que la página esté cargada, pulsa el icono de Issopen y vuelve a capturar.",
    ],
  },
  "page-too-complex": {
    title: "La página tiene demasiados elementos",
    description:
      "Supera el límite de 20.000 elementos que podemos revisar y ocultar de forma segura antes de capturar.",
    steps: [
      "Abre una vista más sencilla de la web o reduce el contenido mostrado. Recortar la imagen no reduce los elementos que debemos revisar.",
    ],
  },
  "selection-cancelled": {
    title: "Selección cancelada",
    description:
      "La selección no se completó: puede haberse cancelado, agotado sus 30 segundos o cambiado la página.",
    steps: [
      "Pulsa Capturar página y selecciona un área de al menos 2 × 2 píxeles. En modo elemento, elige contenido fuera de formularios y confirma con Enter.",
    ],
  },
  "full-page-limit": {
    title: "La página supera el límite de captura completa",
    description:
      "Este modo admite hasta 16.000 píxeles de alto y 20 tramos, sin desplazamiento horizontal.",
    steps: [
      "En Modo, elige Área visible o Recorte de la página y vuelve a capturar.",
    ],
  },
  "image-too-large": {
    title: "La imagen tiene demasiados píxeles",
    description:
      "La imagen supera las dimensiones admitidas: 32 megapíxeles, 8.192 píxeles de ancho o 32.000 de alto.",
    steps: [
      "Reduce el tamaño de la ventana o el zoom. Para una página completa muy larga, prueba Área visible.",
    ],
  },
  "image-too-heavy": {
    title: "La imagen ocupa demasiado espacio",
    description: "El archivo PNG supera el límite de 8 MiB por captura.",
    steps: ["Elige Recorte de la página y selecciona un área más pequeña."],
  },
  "capture-failed": {
    title: "No se pudo completar la captura",
    description:
      "La extensión no pudo preparar la imagen. No tenemos información suficiente para identificar la causa.",
    steps: [
      "Vuelve a pulsar Capturar página cuando la web esté cargada.",
      "Si se repite, indica qué modo usaste y qué hiciste justo antes del aviso. No compartas contraseñas ni datos sensibles.",
    ],
  },
  "extension-unavailable": {
    title: "El panel no pudo comunicarse con la extensión",
    description:
      "El componente de captura no respondió correctamente. Este aviso no indica que hayas perdido la conexión con tu cuenta de Issopen.",
    steps: [
      "Cierra y vuelve a abrir el panel desde el icono de Issopen.",
      "Si persiste, pulsa Recargar en la ficha de Issopen en chrome://extensions. Una captura aún no confirmada se perderá al cerrar el panel.",
    ],
  },
};

export class CaptureFailure extends Error {
  constructor(readonly code: CaptureErrorCode) {
    super(code);
  }
}
export function captureFailure(code: CaptureErrorCode) {
  return {
    ok: false as const,
    code,
    message: captureProblems[code].description,
  };
}
