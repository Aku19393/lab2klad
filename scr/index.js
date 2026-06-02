const {
  QMainWindow,
  QWidget,
  QLabel,
  FlexLayout,
  QPushButton,
  QFileDialog,
  QMessageBox,
  QComboBox,
  FileMode,
  ButtonRole
} = require('@nodegui/nodegui');
const path = require('path');
const { solve } = require('./lab2_klad.js');

const win = new QMainWindow();
win.setWindowTitle("Поиск Клада (NodeGui)");
win.resize(400, 300);

const centralWidget = new QWidget();
centralWidget.setObjectName("myroot");
const rootLayout = new FlexLayout();
centralWidget.setLayout(rootLayout);

// Стили
centralWidget.setStyleSheet(`
  #myroot {
    background-color: #f0f0f0;
    align-items: 'center';
    justify-content: 'center';
    padding: 20px;
  }
  QLabel {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 10px;
  }
  QPushButton {
    font-size: 14px;
    padding: 10px;
    background-color: #007bff;
    color: white;
    border-radius: 5px;
    margin-top: 10px;
    width: 200px;
  }
  QPushButton:hover {
    background-color: #0056b3;
  }
  QComboBox {
    font-size: 14px;
    padding: 5px;
    margin-bottom: 15px;
    width: 200px;
  }
`);

// Заголовок
const titleLabel = new QLabel();
titleLabel.setText("Алгоритм поиска клада");
rootLayout.addWidget(titleLabel);

// Выбор режима
const modeLabel = new QLabel();
modeLabel.setText("Выберите режим:");
modeLabel.setStyleSheet("font-size: 12px; font-weight: normal; margin-bottom: 5px;");
rootLayout.addWidget(modeLabel);

const modeCombo = new QComboBox();
modeCombo.addItem(undefined, "Режим 1 (simple1)");
modeCombo.addItem(undefined, "Режим 2 (simple2)");
modeCombo.addItem(undefined, "Режим 3 (simple3)");
rootLayout.addWidget(modeCombo);

// Кнопка выбора файла
const selectBtn = new QPushButton();
selectBtn.setText("Выбрать карту и запустить");
rootLayout.addWidget(selectBtn);

// Статус
const statusLabel = new QLabel();
statusLabel.setText("");
statusLabel.setStyleSheet("font-size: 12px; font-weight: normal; color: #666; margin-top: 15px;");
rootLayout.addWidget(statusLabel);

selectBtn.addEventListener('clicked', async () => {
  const fileDialog = new QFileDialog();
  fileDialog.setFileMode(FileMode.ExistingFile);
  fileDialog.setNameFilter('Images (*.png *.jpg *.jpeg)');
  fileDialog.exec();

  const selectedFiles = fileDialog.selectedFiles();
  if (selectedFiles.length > 0) {
    const filePath = selectedFiles[0];
    const modeIndex = modeCombo.currentIndex();
    const modeStr = (modeIndex + 1).toString();

    statusLabel.setText(`Обработка файла: ${path.basename(filePath)}...`);
    
    // ВАЖНО: Даем интерфейсу 100 мс, чтобы закрыть окно выбора файла и обновить текст
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Запускаем тяжелый алгоритм
      await solve(filePath, modeStr);
      
      statusLabel.setText("Готово!");
      
      const msgBox = new QMessageBox();
      msgBox.setText(`Успех! Результат сохранен как:\nresult_${path.basename(filePath)}`);
      
      // Добавляем кнопку ОК для корректного закрытия
      const okBtn = new QPushButton();
      okBtn.setText('ОК');
      msgBox.addButton(okBtn, ButtonRole.AcceptRole);
      
      msgBox.exec();
    } catch (err) {
      statusLabel.setText("Ошибка!");
      
      const msgBox = new QMessageBox();
      msgBox.setText(`Произошла ошибка:\n${err.message}`);
      
      const okBtn = new QPushButton();
      okBtn.setText('ОК');
      msgBox.addButton(okBtn, ButtonRole.AcceptRole);
      
      msgBox.exec();
    }
  }
});

win.setCentralWidget(centralWidget);
win.show();

global.win = win; // Предотвращаем сборку мусора
