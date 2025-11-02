import sys
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtGui import QIcon, QPixmap
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView

# Limites
MIN_W, MIN_H = 768, 500
DEFAULT_W, DEFAULT_H = 1137, 624
MAX_W, MAX_H = 2560, 1440  # teto aproximado "2K"

class Browser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("DSW sys")

        # Tamanhos mínimos e iniciais (não uso setMaximumSize)
        self.setMinimumSize(MIN_W, MIN_H)
        self.resize(DEFAULT_W, DEFAULT_H)

        # Ícone transparente (sem ícone visível)
        transparent_icon = QPixmap(32, 32)
        transparent_icon.fill(Qt.transparent)
        self.setWindowIcon(QIcon(transparent_icon))

        # Área central: webview ocupando tudo
        central_widget = QWidget()
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl("http://127.0.0.1:5500/index.html"))
        layout.addWidget(self.browser)

        self.setCentralWidget(central_widget)

        # Garante que os botões nativos fiquem presentes
        self.setWindowFlags(Qt.Window |
                            Qt.WindowMinimizeButtonHint |
                            Qt.WindowMaximizeButtonHint |
                            Qt.WindowCloseButtonHint)

    def resizeEvent(self, event):
        """
        Aplica um teto (MAX_W x MAX_H) só quando a janela está em estado normal
        (ou seja, não quando está maximizada pelo sistema).
        Dessa forma o botão de maximizar não é bloqueado; ao maximizar, o SO assume.
        """
        if not self.isMaximized() and not self.isFullScreen():
            w = self.width()
            h = self.height()
            new_w = min(w, MAX_W)
            new_h = min(h, MAX_H)
            # Se exceder o teto, redimensiona para o tamanho máximo permitido
            if new_w != w or new_h != h:
                # chamar resize aqui ajusta e evita bloquear os botões do SO
                self.resize(new_w, new_h)


        super().resizeEvent(event)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    window = Browser()
    window.show()
    sys.exit(app.exec_())
