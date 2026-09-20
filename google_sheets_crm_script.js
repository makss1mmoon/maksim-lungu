function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Предотвращаем конфликты при одновременных заявках

  try {
    var contents = (e && e.postData) ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Московское время
    var now = new Date();
    var dateStr = Utilities.formatDate(now, "Europe/Moscow", "dd.MM.yyyy");
    var timeStr = Utilities.formatDate(now, "Europe/Moscow", "HH:mm:ss");

    var clientName = (data.name || "").trim();
    var clientPhone = (data.phone || "").trim();
    var clientLevel = (data.level || "Вуз (Бакалавриат)").trim();
    var clientInstitution = (data.institution || "«Синергия»").trim();
    var clientFaculty = (data.faculty || "IT, разработка и ИИ").trim();
    var clientNotes = data.notes || "";

    // ------------------------------------------------------------------------
    // ЛИСТ 1: «Все Лиды» (Главная сводная база)
    // ------------------------------------------------------------------------
    var masterSheet = ss.getSheetByName("Все Лиды");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("Все Лиды", 0);
      masterSheet.appendRow([
        "№", "Дата", "Время", "ФИО / Имя", "Телефон", 
        "Уровень", "Вуз / Колледж", "Направление", "Статус заявки", "Заметки куратора"
      ]);
      
      var header = masterSheet.getRange(1, 1, 1, 10);
      header.setBackground("#D9381E"); // Фирменный красный
      header.setFontColor("#FFFFFF");
      header.setFontWeight("bold");
      header.setHorizontalAlignment("center");
      header.setVerticalAlignment("middle");
      masterSheet.setRowHeight(1, 36);
      masterSheet.setFrozenRows(1);
    }

    var nextId = Math.max(1, masterSheet.getLastRow());

    // Принудительно приводим номер к формату 8XXXXXXXXXX (11 цифр)
    // Префикс "'" гарантирует, что номер останется текстом (без формул #ERROR! и без научной нотации 8E+10)
    var digits = String(clientPhone || "").replace(/\D/g, '');
    var safePhone = "—";
    if (digits.length === 11) {
      safePhone = "'8" + digits.slice(1);
    } else if (digits.length === 10) {
      safePhone = "'8" + digits;
    } else if (digits.length > 0) {
      safePhone = "'8" + digits;
    }

    var masterRow = [
      nextId,
      dateStr,
      timeStr,
      clientName || "Без имени",
      safePhone,
      clientLevel,
      clientInstitution,
      clientFaculty,
      "🔥 Новый",
      clientNotes
    ];

    masterSheet.appendRow(masterRow);

    // Выпадающий список статусов в колонке "Статус заявки" (Колонка I / 9)
    var newRowIndex = masterSheet.getLastRow();
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        "🔥 Новый", 
        "📞 Взят в работу", 
        "⏳ Думает / Перезвонить", 
        "📄 Документы поданы", 
        "🎓 Зачислен", 
        "❌ Нецелевой / Отказ"
      ], true)
      .build();
    masterSheet.getRange(newRowIndex, 9).setDataValidation(statusRule);

    // ------------------------------------------------------------------------
    // ЛИСТ 2: Ежедневный срез (Лист с именем даты, например "20.09.2026")
    // ------------------------------------------------------------------------
    var daySheetName = dateStr;
    var daySheet = ss.getSheetByName(daySheetName);
    if (!daySheet) {
      daySheet = ss.insertSheet(daySheetName, 1);
      daySheet.appendRow([
        "Время", "ФИО / Имя", "Телефон", "Уровень", "Вуз / Колледж", "Направление", "Статус", "Заметки"
      ]);
      
      var dayHeader = daySheet.getRange(1, 1, 1, 8);
      dayHeader.setBackground("#222222");
      dayHeader.setFontColor("#FFFFFF");
      dayHeader.setFontWeight("bold");
      dayHeader.setHorizontalAlignment("center");
      dayHeader.setVerticalAlignment("middle");
      daySheet.setRowHeight(1, 32);
      daySheet.setFrozenRows(1);
    }

    var dayRow = [
      timeStr,
      clientName || "Без имени",
      safePhone,
      clientLevel,
      clientInstitution,
      clientFaculty,
      "🔥 Новый",
      clientNotes
    ];
    daySheet.appendRow(dayRow);
    daySheet.getRange(daySheet.getLastRow(), 7).setDataValidation(statusRule);

    // Автоподбор ширины столбцов
    try {
      masterSheet.autoResizeColumns(1, 10);
      daySheet.autoResizeColumns(1, 8);
    } catch(e) {}

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", row: newRowIndex }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("✅ CRM Webhook Университета Синергия, МТИ и МАП работает!");
}
