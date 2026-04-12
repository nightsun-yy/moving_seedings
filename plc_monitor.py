import time
import logging
from pymodbus.client import ModbusTcpClient

# 配置日志记录
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class PLCMonitor:
    """
    PLC 数据监控类
    用于通过 Modbus TCP 连接并读取 PLC 寄存器数据
    """
    def __init__(self, ip: str = "192.168.40.10", port: int = 502, slave_id: int = 1):
        self.ip = ip
        self.port = port
        self.slave_id = slave_id
        self.client = ModbusTcpClient(self.ip, port=self.port)
        self.is_connected = False

    def connect(self) -> bool:
        """建立与 PLC 的连接"""
        logging.info(f"正在连接 PLC: {self.ip}:{self.port} ...")
        self.is_connected = self.client.connect()
        if self.is_connected:
            logging.info("✅ 连接成功！")
        else:
            logging.error("❌ 连接失败，请检查网络或 PLC 设置。")
        return self.is_connected

    def disconnect(self):
        """断开连接"""
        if self.is_connected:
            self.client.close()
            logging.info("连接已断开。")
            self.is_connected = False

    def read_data(self) -> dict:
        """
        读取并解析 PLC 保持寄存器 (Holding Registers) 数据
        返回解析后的字典格式数据
        """
        if not self.is_connected:
            return {"状态": "未连接"}

        try:
            # 读取地址从 0 开始的 4 个寄存器
            result = self.client.read_holding_registers(
                address=0,
                count=4,
                slave=self.slave_id
            )
            
            if not result.isError():
                reg = result.registers
                # 根据实际业务逻辑解析寄存器数据
                return {
                    "时间": time.strftime("%H:%M:%S"),
                    "托盘位置": reg[0],
                    "电机转速": reg[1],
                    "温度": reg[2]
                }
            else:
                logging.warning(f"读取数据错误: {result}")
                return {"错误": "Modbus 读取失败"}

        except Exception as e:
            logging.error(f"读取数据时发生异常: {e}")
            return {"异常": str(e)}

    def run(self, interval: float = 0.5):
        """持续运行并读取数据"""
        if not self.connect():
            return

        logging.info("开始持续监控数据 (按 Ctrl+C 停止)...\n")
        try:
            while True:
                data = self.read_data()
                print(data)
                time.sleep(interval)
        except KeyboardInterrupt:
            logging.info("\n接收到停止信号，正在退出...")
        finally:
            self.disconnect()

if __name__ == "__main__":
    # 实例化并运行监控
    monitor = PLCMonitor(ip="192.168.40.10", port=502)
    monitor.run(interval=0.5)
