import * as eng from "../engine/index.js";
import type { ServiceInfo } from "./types.js";
import { app } from "./views/app.js";

const font = `"Chicago","Helvetica","Arial",sans-serif`;

function error(message: string) {
  const elemDiv = document.createElement("div");
  elemDiv.style.fontFamily = font;
  elemDiv.style.fontWeight = "bold";
  elemDiv.style.fontSize = "x-large";
  elemDiv.style.display = "flex";
  elemDiv.style.justifyContent = "center";
  elemDiv.style.alignItems = "center";
  elemDiv.style.height = "100vh";
  elemDiv.style.textAlign = "center";
  elemDiv.innerHTML = message;
  document.body.append(elemDiv);
}

export async function run(params: URLSearchParams) {
  const host = params.get("host") ?? "localhost";
  const control_port = params.get("control") ?? "8080";
  // const streaming_port = params.get("streaming") ?? "8080";
  const secured = params.get("secured") ?? "false";
  const shema = secured == "true" ? "https" : "http";
  const control = `${shema}://${host}:${control_port}`;
  // const _streaming = `${shema}://${host}:${streaming_port}`;
  const service = new URL("/v1/service", control);
  try {
    const response = await fetch(service, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) {
      error(`Unable to connect to debugger control ${host}:${control_port}`);
    } else {
      const service = (await response.json()) as ServiceInfo;
      console.log(service);
      await eng.launch(document.title, (_scope) => {
        return app(service);
      });
    }
  } catch (_e: unknown) {
    error(`Unable to connect to debugger control ${host}:${control_port}`);
  }
}

const searchParams = new URLSearchParams(window.location.search);

await run(searchParams);
