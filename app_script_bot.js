// Hàm để lấy dữ liệu từ Google Sheet
function getSheetData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
    if (!sheet) {
      Logger.log("Sheet 'Data' không tồn tại");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) {
      Logger.log("Không có dữ liệu trong sheet");
      return [];
    }
    
    Logger.log("Đã lấy được " + data.length + " dòng dữ liệu");
    return data;
  } catch (error) {
    Logger.log("Lỗi khi lấy dữ liệu từ sheet: " + error.message);
    return [];
  }
}

// Hàm tìm câu trả lời phù hợp
function findAnswer(question) {
  try {
    // Kiểm tra đầu vào
    if (!question || typeof question !== 'string') {
      Logger.log("Câu hỏi không hợp lệ");
      return null;
    }
    
    const data = getSheetData();
    if (data.length <= 1) { // Chỉ có header hoặc không có dữ liệu
      Logger.log("Không có dữ liệu để tìm kiếm");
      return null;
    }
    
    const questionLower = question.toLowerCase().trim();
    Logger.log("Đang tìm kiếm câu trả lời cho: " + questionLower);
    
    // Tạo danh sách các từ khóa từ câu hỏi
    const keywords = questionLower.split(/\s+/).filter(word => word.length > 2);
    Logger.log("Từ khóa tìm kiếm: " + keywords.join(", "));
    
    let bestMatch = null;
    let bestMatchScore = 0;
    
    // Bỏ qua header row
    for (let i = 1; i < data.length; i++) {
      // Kiểm tra xem câu hỏi có tồn tại và là chuỗi không
      if (data[i][0] && typeof data[i][0] === 'string') {
        const dataQuestionLower = data[i][0].toLowerCase().trim();
        Logger.log("So sánh với: " + dataQuestionLower);
        
        // Tính điểm khớp
        let matchScore = 0;
        for (const keyword of keywords) {
          if (dataQuestionLower.includes(keyword)) {
            matchScore++;
          }
        }
        
        // Nếu tìm thấy khớp hoàn toàn
        if (dataQuestionLower === questionLower) {
          Logger.log("Tìm thấy khớp hoàn toàn ở dòng " + i);
          return data[i][1] || "Xin lỗi, tôi không tìm thấy câu trả lời phù hợp.";
        }
        
        // Cập nhật kết quả tốt nhất
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          bestMatch = data[i][1];
        }
      }
    }
    
    // Nếu có kết quả tốt nhất
    if (bestMatchScore > 0) {
      Logger.log("Tìm thấy kết quả tốt nhất với điểm số: " + bestMatchScore);
      return bestMatch;
    }
    
    Logger.log("Không tìm thấy câu trả lời phù hợp");
    return null;
  } catch (error) {
    Logger.log("Lỗi khi tìm câu trả lời: " + error.message);
    return null;
  }
}

// Hỗ trợ xử lý cả request JSONP
function doGet(e) {
  try {
    // Kiểm tra nếu e hoặc e.parameter không tồn tại
    e = e || {};
    e.parameter = e.parameter || {};
    
    let question = e.parameter.question || "";
    let callback = e.parameter.callback || "";
    
    if (!question) {
      const response = { 
        success: false, 
        message: "Vui lòng cung cấp câu hỏi qua tham số 'question'" 
      };
      
      if (callback) {
        // Trả về response JSONP
        return ContentService.createTextOutput(callback + "(" + JSON.stringify(response) + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      } else {
        // Trả về JSON thông thường
        return ContentService.createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Tìm câu trả lời trong sheet
    const answer = findAnswer(question);
    
    // Chuẩn bị response
    const response = {
      success: true,
      answer: answer || "Xin lỗi, tôi không tìm thấy câu trả lời cho câu hỏi của bạn."
    };
    
    if (callback) {
      // Trả về response JSONP
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(response) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      // Trả về JSON thông thường
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    Logger.log("Lỗi trong doGet: " + error.message);
    
    const response = {
      success: false,
      message: "Có lỗi xảy ra: " + error.message
    };
    
    if (e && e.parameter && e.parameter.callback) {
      // Trả về response JSONP
      return ContentService.createTextOutput(e.parameter.callback + "(" + JSON.stringify(response) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      // Trả về JSON thông thường
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// Hàm xử lý POST request (giữ tương thích)
function doPost(e) {
  return doGet(e);
}

// Hàm test
function testDoGet() {
  try {
    // Tạo đối tượng giả lập e 
    const e = {
      parameter: {
        question: "Xin chào"
      }
    };
    
    // Gọi doGet với tham số
    const result = doGet(e);
    Logger.log("Test doGet result: " + result.getContent());
    return "Test hoàn thành. Kết quả: " + result.getContent();
  } catch (error) {
    Logger.log("Lỗi trong testDoGet: " + error.message);
    return "Lỗi khi test: " + error.message;
  }
}

// Hàm test findAnswer
function testFindAnswer() {
  try {
    // Test với câu hỏi hợp lệ
    const testQuestion = "Xin chào";
    Logger.log("=== Test với câu hỏi hợp lệ ===");
    const answer = findAnswer(testQuestion);
    Logger.log("Test question: " + testQuestion);
    Logger.log("Answer: " + answer);
    
    // Test với câu hỏi rỗng
    Logger.log("\n=== Test với câu hỏi rỗng ===");
    const emptyAnswer = findAnswer("");
    Logger.log("Empty question answer: " + emptyAnswer);
    
    // Test với câu hỏi null
    Logger.log("\n=== Test với câu hỏi null ===");
    const nullAnswer = findAnswer(null);
    Logger.log("Null question answer: " + nullAnswer);
    
    // Test với câu hỏi không tồn tại trong sheet
    Logger.log("\n=== Test với câu hỏi không tồn tại ===");
    const notFoundAnswer = findAnswer("abcdefghijk");
    Logger.log("Not found question answer: " + notFoundAnswer);
    
    // Test với câu hỏi có từ khóa tương tự
    Logger.log("\n=== Test với câu hỏi có từ khóa tương tự ===");
    const similarAnswer = findAnswer("chào bạn");
    Logger.log("Similar question answer: " + similarAnswer);
    
    return "Test hoàn thành, kiểm tra log để xem kết quả.";
  } catch (error) {
    Logger.log("Lỗi trong testFindAnswer: " + error.message);
    return "Lỗi khi test: " + error.message;
  }
}