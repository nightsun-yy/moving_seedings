# PLC 数据监控项目 (PLC Monitor)

本项目通过 **Modbus TCP** 协议与工业控制设备（PLC）进行通信，并实时读取并监控其寄存器中的运行数据。

## 1. 主要功能

- **实时读取**：周期性获取 PLC 的寄存器数据（如托盘位置、电机转速、温度等）。
- **对象化封装**：通过 `PLCMonitor` 类实现连接、读取和断开操作，代码结构清晰，易于扩展。
- **日志记录**：自动记录连接状态、成功/失败日志以及异常信息。
- **优雅退出**：支持通过 `Ctrl+C` 快捷键安全地停止程序并断开 PLC 连接。

## 2. 环境要求

- Python 3.x
- `pymodbus` 库

安装依赖：
```bash
pip install pymodbus
```

## 3. 使用方法

1.  **修改配置**：在 `plc_monitor.py` 的 `if __name__ == "__main__":` 部分修改 PLC 的 IP 地址和端口。
2.  **启动程序**：
    ```bash
    python plc_monitor.py
    ```

## 4. 文件结构

- `plc_monitor.py`: 主程序代码，实现 Modbus TCP 客户端功能。
- `README.md`: 项目使用说明书。

## 5. 注意事项

- 请确保你的 PLC 已开启 Modbus TCP 服务，且 IP 地址与脚本配置一致。
- 本程序默认读取地址 0 开始的 4 个保持寄存器，你可以根据具体 PLC 的寄存器表修改 `read_data` 方法中的 `address` 和 `count` 参数。
