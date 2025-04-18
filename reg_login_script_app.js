function myFunction() {
  
}/**
 * Xử lý yêu cầu POST từ trang web
 */
function doPost(e) {
  try {
    // Kiểm tra xem e và e.postData có tồn tại không
    if (!e || !e.postData) {
      Logger.log("Lỗi: Không có dữ liệu request");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Không có dữ liệu request"
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ghi log để debug
    Logger.log("Nhận được request: " + e.postData.contents);
    
    // Lấy dữ liệu từ request
    const data = JSON.parse(e.postData.contents);
    const username = data.username;
    const password = data.password;
    
    // Xử lý đăng nhập và lưu thông tin
    const result = handleLogin(username, password);
    
    // Trả về kết quả dạng JSON
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("Lỗi: " + error.toString());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Lỗi: " + error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hàm test giả lập doPost - THÊM HÀNG NÀY 
 */
function testDoPost() {
  // Giả lập dữ liệu request
  const mockRequestData = {
    postData: {
      contents: JSON.stringify({
        username: "testuser",
        password: "testpassword"
      })
    }
  };
  
  // Gọi doPost với dữ liệu giả lập
  const result = doPost(mockRequestData);
  
  // Log kết quả
  Logger.log("Kết quả doPost: " + result.getContent());
}

/**
 * Hàm test để kiểm tra trực tiếp trong Apps Script
 */
function testLogin() {
  const result = handleLogin("testuser", "testpassword");
  Logger.log("Kết quả test: " + JSON.stringify(result));
  return result;
}

/**
 * Hàm test riêng cho appendLoginAttempt
 */
function testAppendLogin() {
  try {
    // Lấy spreadsheet hiện tại
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!ss) {
      Logger.log("Không tìm thấy spreadsheet");
      return;
    }
    
    // Kiểm tra và tạo sheet nếu cần
    let sheet = ss.getSheetByName("Đăng nhập");
    
    if (!sheet) {
      // Tạo sheet mới nếu không tồn tại
      Logger.log("Sheet 'Đăng nhập' không tồn tại. Đang tạo mới...");
      sheet = ss.insertSheet("Đăng nhập");
      // Thêm tiêu đề cột
      sheet.appendRow(["User", "Password", "Thời gian", "Trạng thái"]);
    }
    
    // Thử thêm tài khoản test
    const result = appendLoginAttempt(sheet, "testuser", "testpassword", "Test");
    Logger.log("Kết quả thêm tài khoản: " + result);
    
  } catch (error) {
    Logger.log("Lỗi khi test appendLoginAttempt: " + error);
  }
}

/**
 * Xử lý đăng nhập và lưu thông tin
 */
function handleLogin(username, password) {
  try {
    // Mở Google Sheet và sheet "Đăng nhập"
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!ss) {
      Logger.log("Không thể mở Spreadsheet");
      return {
        success: false,
        message: "Không thể kết nối đến cơ sở dữ liệu"
      };
    }
    
    // Tìm hoặc tạo sheet "Đăng nhập"
    let sheet = ss.getSheetByName("Đăng nhập");
    
    if (!sheet) {
      // Thử lấy active sheet
      sheet = ss.getActiveSheet();
      
      if (!sheet) {
        // Nếu vẫn không có sheet, tạo mới
        Logger.log("Không tìm thấy sheet. Đang tạo mới...");
        sheet = ss.insertSheet("Đăng nhập");
        sheet.appendRow(["User", "Password", "Thời gian", "Trạng thái"]);
      }
    }
    
    // Kiểm tra lại một lần nữa để đảm bảo sheet tồn tại
    if (!sheet) {
      return {
        success: false,
        message: "Không thể tạo hoặc tìm thấy sheet cần thiết"
      };
    }
    
    // Lấy dữ liệu từ sheet
    const data = sheet.getDataRange().getValues();
    let userExists = false;
    let isAuthenticated = false;
    
    // Kiểm tra xác thực
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username) {
        userExists = true;
        if (data[i][1] === password) {
          isAuthenticated = true;
        }
        break;
      }
    }
    
    // Nếu user = upedu và pass = upedu1234 thì luôn cho đăng nhập (từ dữ liệu đã có)
    if (username === "upedu" && password === "upedu1234") {
      isAuthenticated = true;
      userExists = true;
    }
    
    if (userExists && !isAuthenticated) {
      // Người dùng tồn tại nhưng mật khẩu sai
      const saveResult = appendLoginAttempt(sheet, username, password, "Sai mật khẩu");
      Logger.log("Kết quả lưu thông tin sai mật khẩu: " + saveResult);
      
      return {
        success: false,
        message: "Tên đăng nhập hoặc mật khẩu không đúng"
      };
    }
    
    // Xử lý đăng nhập thành công hoặc thêm tài khoản mới
    if (!userExists) {
      // Người dùng mới - thêm vào sheet
      const saveResult = appendLoginAttempt(sheet, username, password, "Người dùng mới");
      Logger.log("Kết quả lưu thông tin người dùng mới: " + saveResult);
    } else {
      // Đăng nhập thành công - cập nhật thời gian đăng nhập
      const saveResult = appendLoginAttempt(sheet, username, password, "Đăng nhập thành công");
      Logger.log("Kết quả lưu thông tin đăng nhập thành công: " + saveResult);
    }
    
    return {
      success: true,
      message: "Đăng nhập thành công",
      user: { username: username }
    };
    
  } catch (error) {
    Logger.log("Lỗi xử lý đăng nhập: " + error.toString());
    return { 
      success: false, 
      message: "Lỗi xử lý đăng nhập: " + error.toString() 
    };
  }
}

/**
 * Hàm thêm thông tin đăng nhập vào sheet
 */
function appendLoginAttempt(sheet, username, password, status) {
  try {
    // Kiểm tra sheet có tồn tại không
    if (!sheet) {
      Logger.log("Lỗi: Sheet là null hoặc undefined");
      return false;
    }
    
    const now = new Date();
    
    // Kiểm tra xem người dùng đã tồn tại chưa
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username) {
        rowIndex = i + 1; // +1 vì index bắt đầu từ 1 trong sheet
        break;
      }
    }
    
    if (rowIndex > 0) {
      // Cập nhật thông tin người dùng đã tồn tại
      sheet.getRange(rowIndex, 2).setValue(password); // Cập nhật mật khẩu
      sheet.getRange(rowIndex, 3).setValue(now); // Cập nhật thời gian ở cột C (vị trí)
      sheet.getRange(rowIndex, 4).setValue(status); // Cập nhật trạng thái ở cột D (Data)
    } else {
      // Thêm người dùng mới
      sheet.appendRow([username, password, now, status]);
    }
    
    return true;
  } catch (error) {
    Logger.log("Lỗi khi lưu thông tin: " + error.toString());
    return false;
  }
}