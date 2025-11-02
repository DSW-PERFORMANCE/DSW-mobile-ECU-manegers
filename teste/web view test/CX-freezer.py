import sys
import os
import subprocess
import tkinter.messagebox as messagebox
import customtkinter as ctk
from tkinter import filedialog

class CxFreezeConfigApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Configuração cx_Freeze")
        self.geometry("500x600")
        self.resizable(False,False)

        # Frame principal com Scroll
        self.main_frame = ctk.CTkScrollableFrame(self, width=480, height=580)
        self.main_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.folder_path = ""
        self.main_script_var = ctk.StringVar()
        self.icon_var = ctk.StringVar(value="")  # Padrão: Sem ícone
        self.description = ""
        self.name = ""
        self.base_var = ctk.StringVar(value="Console")

        # Pasta
        self.folder_label = ctk.CTkLabel(self.main_frame, text="Selecione a pasta com os arquivos Python:")
        self.folder_label.pack(pady=5)

        self.folder_button = ctk.CTkButton(self.main_frame, text="Escolher pasta", command=self.select_folder)
        self.folder_button.pack(pady=5)

        # ScrollableFrame para scripts
        self.main_script_label = ctk.CTkLabel(self.main_frame, text="Escolha o script principal:")
        self.main_script_label.pack(pady=5)

        self.main_script_frame = ctk.CTkScrollableFrame(self.main_frame, width=460, height=100)
        self.main_script_frame.pack(pady=5, fill="both", expand=True)

        # ScrollableFrame para ícones
        self.icon_label = ctk.CTkLabel(self.main_frame, text="Escolha o ícone (ou nenhum):")
        self.icon_label.pack(pady=5)

        self.icon_frame = ctk.CTkScrollableFrame(self.main_frame, width=460, height=100)
        self.icon_frame.pack(pady=5, fill="both", expand=True)

        # Base do executável
        self.base_label = ctk.CTkLabel(self.main_frame, text="Selecione a base do executável:")
        self.base_label.pack(pady=5)

        self.base_console = ctk.CTkRadioButton(self.main_frame, text="Console", variable=self.base_var, value="Console")
        self.base_console.pack()

        self.base_gui = ctk.CTkRadioButton(self.main_frame, text="Win32GUI", variable=self.base_var, value="Win32GUI")
        self.base_gui.pack()

        # Descrição
        self.description_label = ctk.CTkLabel(self.main_frame, text="Descrição do executável:")
        self.description_label.pack(pady=5)

        self.description_entry = ctk.CTkEntry(self.main_frame, width=400)
        self.description_entry.pack(pady=5)

        # Nome
        self.name_label = ctk.CTkLabel(self.main_frame, text="Nome do executável:")
        self.name_label.pack(pady=5)

        self.name_entry = ctk.CTkEntry(self.main_frame, width=400)
        self.name_entry.pack(pady=5)

        # Botão para gerar EXE
        self.generate_button = ctk.CTkButton(self.main_frame, text="Criar Executável", command=self.create_exe)
        self.generate_button.pack(pady=20)

    def select_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.folder_path = folder
            self.update_files_list()

    def update_files_list(self):
        # Limpar widgets antigos
        for widget in self.main_script_frame.winfo_children():
            widget.destroy()
        for widget in self.icon_frame.winfo_children():
            widget.destroy()

        # Adicionar scripts Python
        scripts = [f for f in os.listdir(self.folder_path) if f.endswith(".py")]
        for script in scripts:
            rb = ctk.CTkRadioButton(self.main_script_frame, text=script, variable=self.main_script_var, value=script)
            rb.pack(anchor="w")

        # Adicionar opção "Sem Ícone" sempre
        self.no_icon_button = ctk.CTkRadioButton(self.icon_frame, text="Sem ícone", variable=self.icon_var, value="")
        self.no_icon_button.pack(anchor="w")

        # Adicionar ícones
        icons = [f for f in os.listdir(self.folder_path) if f.endswith(".ico")]
        for icon in icons:
            rb = ctk.CTkRadioButton(self.icon_frame, text=icon, variable=self.icon_var, value=icon)
            rb.pack(anchor="w")

    def create_exe(self):
        self.description = self.description_entry.get()
        self.name = self.name_entry.get()
        main_script = self.main_script_var.get()
        icon = self.icon_var.get()
        base = self.base_var.get()

        if not main_script or not self.name or not self.description:
            messagebox.showerror("Erro", "Preencha todos os campos e selecione os arquivos corretamente.")
            return

        icon_path = os.path.abspath(os.path.join(self.folder_path, icon)) if icon else None
        icon_setup = f'"{icon_path.replace("\\", "/")}"' if icon else "None"


        # Criar setup.py dentro da pasta escolhida
        setup_path = os.path.join(self.folder_path, "setup.py")
        setup_content = f"""
import sys
import os
from cx_Freeze import setup, Executable

executables = [
    Executable(
        script="{main_script}",
        base="{base}" if sys.platform == "win32" else None,
        icon={icon_setup}
    )
]

setup(
    name="{self.name}",
    version="1.0",
    description="{self.description}",
    executables=executables
)
        """

        with open(setup_path, "w") as f:
            f.write(setup_content)

        # Muda para a pasta antes de executar
        os.chdir(self.folder_path)

        # Executa o setup.py para criar o executável
        try:
            subprocess.run([sys.executable, "setup.py", "build"], check=True)
            messagebox.showinfo("Sucesso", "Executável gerado com sucesso!")
                    # Apagar o setup.py após a criação do executável
            try:
                os.remove(setup_path)
            except Exception as e:
                messagebox.showwarning("Aviso", f"Não foi possível apagar o setup.py:\n{e}")

        except subprocess.CalledProcessError as e:
            messagebox.showerror("Erro", f"Erro ao criar o executável:\n{e}")


if __name__ == "__main__":
    app = CxFreezeConfigApp()
    app.mainloop()
