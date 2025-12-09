import threading
import time
import serial
import webview

class ECUBridge:
    def __init__(self, port="COM10", baudrate=115200):
        self.port_name = port
        self.baudrate = baudrate
        self.serial_port = None
        self.is_online = False
        self.lock = threading.Lock()
        self.running = True

        # Mantém o status anterior para detectar mudança
        self._last_status = None

        # Thread de reconexão e monitoramento
        threading.Thread(target=self.monitor_connection, daemon=True).start()

    def monitor_connection(self):
        while self.running:
            online_now = False
            try:
                if self.serial_port and self.serial_port.is_open:
                    # Porta aberta → está online
                    online_now = True
                else:
                    # Tenta abrir a porta
                    self.serial_port = serial.Serial(self.port_name, self.baudrate, timeout=1)
                    online_now = True
            except (serial.SerialException, OSError):
                online_now = False
                if self.serial_port:
                    try:
                        self.serial_port.close()
                    except:
                        pass
                    self.serial_port = None

            # Se status mudou, atualiza badge
            if online_now != self._last_status:
                self.is_online = online_now
                self._notify_status()
                self._last_status = online_now
                print(f"[ECU] Status alterado: {'ONLINE' if online_now else 'OFFLINE'}")

            time.sleep(2)

    def _notify_status(self):
        try:
            js_code = f"window.ecuCommunication.setStatus({str(self.is_online).lower()})"
            webview.evaluate_js(js_code)
        except Exception:
            pass

    # ===== APIs JS =====
    def get_status(self):
        return {"online": self.is_online}

    def send_command(self, command, value):
        if not self.is_online or not self.serial_port:
            return {"ok": False, "error": "ECU offline"}

        try:
            msg = f"{command}={value}\n".encode()
            with self.lock:
                self.serial_port.write(msg)
                response = self.serial_port.readline().decode(errors="ignore").strip()
            print(f"[→] {msg.decode().strip()} | [←] {response}")
            return {"ok": True, "response": response}
        except Exception as e:
            self.is_online = False
            self._notify_status()
            return {"ok": False, "error": str(e)}

    def query_command(self, command):
        if not self.is_online or not self.serial_port:
            return {"ok": False, "value": 0}

        try:
            msg = f"{command}?\n".encode()
            with self.lock:
                self.serial_port.write(msg)
                response = self.serial_port.readline().decode(errors="ignore").strip()
            print(f"[→] {msg.decode().strip()} | [←] {response}")
            return {"ok": True, "value": response}
        except Exception as e:
            self.is_online = False
            self._notify_status()
            return {"ok": False, "error": str(e)}

if __name__ == "__main__":

    api = ECUBridge(port="COM3", baudrate=115200)

    window = webview.create_window(
        "DSW ECU",
        "web/index.html",
        js_api=api,
        width=1000,
        height=700, 
        background_color="#333333",
        min_size=(893,504),
        
    )

    webview.start(debug=False,icon="web/icon.ico")
