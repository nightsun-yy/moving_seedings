import json
import logging
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

from pymodbus.client import ModbusTcpClient


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


class TwinSystemMonitor:
    """
    育苗设备数字孪生 PLC 监控类
    x轴: REAL, y轴: REAL, z轴: INT
    """

    def __init__(self, ip: str = "192.168.40.10", port: int = 502, slave_id: int = 1):
        self.ip = ip
        self.port = port
        self.slave_id = slave_id
        self.client = ModbusTcpClient(self.ip, port=self.port)
        self.is_connected = False

        # ----- 寄存器地址配置 (根据你的 PLC 实际点位修改) -----
        self.x_addr = 0
        self.y_addr = 2
        self.z_addr = 4

        self.byteorder = '>f'
        self.scale = 1.0

        self._stop_event = threading.Event()
        self._latest_data_lock = threading.Lock()
        self._latest_data = self._build_snapshot(None, None, None, connected=False, status="设备离线")
        self._next_reconnect_at = 0.0

    def connect(self) -> bool:
        logging.info(f"正在建立工业网络连接: {self.ip}:{self.port} ...")
        self.is_connected = self.client.connect()
        if self.is_connected:
            logging.info("✅ 物理层连接成功！")
        else:
            logging.error("❌ 物理层连接失败，请检查网线或 PLC 运行状态。")
        return self.is_connected

    def disconnect(self):
        if self.is_connected:
            self.client.close()
            logging.info("工业网络连接已断开。")
            self.is_connected = False

    def _build_snapshot(
        self,
        x_value: Optional[float],
        y_value: Optional[float],
        z_value: Optional[int],
        *,
        connected: bool,
        status: str,
    ) -> dict:
        return {
            "gateway": "online",
            "connected": connected,
            "time": time.strftime("%H:%M:%S"),
            "status": status,
            "x": round(x_value * self.scale, 2) if x_value is not None else None,
            "y": round(y_value * self.scale, 2) if y_value is not None else None,
            "z": int(z_value * self.scale) if z_value is not None else None,
            "x轴": round(x_value * self.scale, 2) if x_value is not None else "读取失败",
            "y轴": round(y_value * self.scale, 2) if y_value is not None else "读取失败",
            "z轴": int(z_value * self.scale) if z_value is not None else "读取失败",
        }

    def _set_latest_data(self, snapshot: dict):
        with self._latest_data_lock:
            self._latest_data = snapshot

    def get_latest_data(self) -> dict:
        with self._latest_data_lock:
            return dict(self._latest_data)

    def _read_real(self, addr: int) -> Optional[float]:
        """读取 32 位浮点数 (REAL)"""
        if not self.is_connected:
            return None
        try:
            result = self.client.read_holding_registers(address=addr, count=2, slave=self.slave_id)
            if result.isError():
                return None
            regs = result.registers
            combined = (regs[0] << 16) | regs[1]
            return struct.unpack(self.byteorder, struct.pack('>I' if '>' in self.byteorder else '<I', combined))[0]
        except Exception:
            return None

    def _read_int(self, addr: int) -> Optional[int]:
        """读取 16 位有符号整数 (INT)"""
        if not self.is_connected:
            return None
        try:
            result = self.client.read_holding_registers(address=addr, count=1, slave=self.slave_id)
            if result.isError():
                return None
            val = result.registers[0]
            return val if val < 32768 else val - 65536
        except Exception:
            return None

    def read_axis_snapshot(self) -> dict:
        """读取设备三轴实时坐标，返回适合前端直接消费的数据"""
        if not self.is_connected:
            return self._build_snapshot(None, None, None, connected=False, status="设备离线")

        val_x = self._read_real(self.x_addr)
        val_y = self._read_real(self.y_addr)
        val_z = self._read_int(self.z_addr)

        return self._build_snapshot(
            val_x,
            val_y,
            val_z,
            connected=True,
            status="读取完成" if all(value is not None for value in (val_x, val_y, val_z)) else "部分点位读取失败",
        )

    def read_axis_data(self) -> dict:
        """兼容旧逻辑：返回中文键名为主的数据字典"""
        snapshot = self.read_axis_snapshot()
        if not snapshot["connected"]:
            return {"状态": "设备离线", "时间": snapshot["time"], "x轴": "读取失败", "y轴": "读取失败", "z轴": "读取失败"}

        return {
            "时间": snapshot["time"],
            "x轴": snapshot["x轴"],
            "y轴": snapshot["y轴"],
            "z轴": snapshot["z轴"],
        }

    def _sampling_loop(self, interval: float):
        logging.info("开始实时同步育苗装置坐标，并向本地 HTTP 接口提供数据...")

        while not self._stop_event.is_set():
            if not self.is_connected and time.time() >= self._next_reconnect_at:
                self.connect()
                self._next_reconnect_at = time.time() + 2.0

            snapshot = self.read_axis_snapshot()
            self._set_latest_data(snapshot)

            print(
                f"[{snapshot['time']}] 实时位置 >> "
                f"x轴: {snapshot['x轴']} | y轴: {snapshot['y轴']} | z轴: {snapshot['z轴']}"
            )

            self._stop_event.wait(interval)

    def serve_api(self, host: str = "127.0.0.1", port: int = 8765, interval: float = 0.5):
        monitor = self
        self._stop_event.clear()

        class RequestHandler(BaseHTTPRequestHandler):
            def _send_json(self, status_code: int, payload: dict):
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status_code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(body)

            def do_OPTIONS(self):
                self.send_response(204)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()

            def do_GET(self):
                if self.path in ("/api/axis", "/api/axis/"):
                    self._send_json(200, monitor.get_latest_data())
                    return

                if self.path in ("/health", "/healthz"):
                    snapshot = monitor.get_latest_data()
                    self._send_json(
                        200,
                        {
                            "ok": True,
                            "gateway": "online",
                            "plc_connected": snapshot["connected"],
                            "time": snapshot["time"],
                        },
                    )
                    return

                self._send_json(404, {"ok": False, "message": "Not Found"})

            def log_message(self, fmt: str, *args):
                logging.info("HTTP - " + fmt, *args)

        server = ThreadingHTTPServer((host, port), RequestHandler)
        sampler_thread = threading.Thread(target=self._sampling_loop, args=(interval,), daemon=True)
        sampler_thread.start()

        logging.info(f"本地数据接口已启动: http://{host}:{port}/api/axis")

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            logging.info("收到停止信号，正在关闭数据接口...")
        finally:
            self._stop_event.set()
            server.shutdown()
            server.server_close()
            sampler_thread.join(timeout=1.0)
            self.disconnect()

    def run(self, interval: float = 0.5):
        if not self.connect():
            return
        logging.info("开始实时同步育苗装置坐标 (按 Ctrl+C 停止)...\n")
        try:
            while True:
                data = self.read_axis_data()
                print(f"[{data['时间']}] 实时位置 >> x轴: {data['x轴']} | y轴: {data['y轴']} | z轴: {data['z轴']}")
                time.sleep(interval)
        except KeyboardInterrupt:
            logging.info("\n监控程序已停止。")
        finally:
            self.disconnect()


if __name__ == "__main__":
    monitor = TwinSystemMonitor(ip="192.168.40.10")
    monitor.serve_api(host="127.0.0.1", port=8765, interval=0.5)
