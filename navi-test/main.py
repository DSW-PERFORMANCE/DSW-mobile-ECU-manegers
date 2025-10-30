import sys
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtGui import QIcon, QPixmap
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView


class Browser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("DSW")
        self.setMinimumSize(768, 500)
        self.resize(1137, 624)
        self.setMaximumSize(2560, 1440)

        # === Ícone transparente ===
        transparent_icon = QPixmap(32, 32)
        transparent_icon.fill(Qt.transparent)
        self.setWindowIcon(QIcon(transparent_icon))

        # === Interface central ===
        central_widget = QWidget()
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # === Navegador ===
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl("http://127.0.0.1:5500/index.html"))
        layout.addWidget(self.browser)

        self.setCentralWidget(central_widget)


if __name__ == "__main__":
    app = QApplication(sys.argv)

    # === Tema segue o do Windows automaticamente ===
    app.setStyle("Fusion")  # respeita o tema do SO
    # Qt aplica automaticamente a aparência (dark/light) conforme Windows

    window = Browser()
    window.show()
    sys.exit(app.exec_())
