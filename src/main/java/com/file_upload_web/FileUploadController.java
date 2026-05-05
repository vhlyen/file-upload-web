package com.file_upload_web;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

@RestController
@CrossOrigin("*")
public class FileUploadController {

    private final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads";
    private final String RESOURCES_FILE = System.getProperty("user.dir") + "/resources.json";
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String ADMIN_USERNAME = "vhlyen";
    private static final String ADMIN_PASSWORD = "Lyen2808";

    // ===== Authentication Endpoints =====

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> payload, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        String username = payload.get("username");
        String password = payload.get("password");

        if (ADMIN_USERNAME.equals(username) && ADMIN_PASSWORD.equals(password)) {
            session.setAttribute("admin", true);
            session.setAttribute("adminName", username);
            response.put("success", true);
            response.put("adminName", username);
            response.put("message", "Login successful");
        } else {
            response.put("success", false);
            response.put("message", "Invalid username or password");
        }

        return response;
    }

    @GetMapping("/auth/verify")
    public Map<String, Object> verifyAuth(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        Boolean isAdmin = (Boolean) session.getAttribute("admin");

        if (isAdmin != null && isAdmin) {
            response.put("authenticated", true);
            response.put("adminName", session.getAttribute("adminName"));
        } else {
            response.put("authenticated", false);
        }

        return response;
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpSession session) {
        session.invalidate();
        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Logged out successfully");
        return response;
    }

    // ===== Upload Endpoints =====

    @PostMapping("/upload")
    public Map<String, String> uploadFile(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("section") String section,
            @RequestParam("description") String description,
            @RequestParam(value = "documentLink", required = false) String documentLink,
            @RequestParam(value = "videoLink", required = false) String videoLink,
            HttpSession session) {
        
        // Check if admin
        if (!isAdmin(session)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Unauthorized");
            return response;
        }

        try {
            Map<String, String> response = new HashMap<>();
            String uploadedFileName = null;

            // Upload file if provided
            if (file != null && !file.isEmpty()) {
                File dir = new File(UPLOAD_DIR);
                if (!dir.exists()) dir.mkdirs();

                uploadedFileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
                String filePath = UPLOAD_DIR + File.separator + uploadedFileName;
                file.transferTo(new File(filePath));
            }

            // Save resource metadata
            saveResource(section, description, uploadedFileName, documentLink, videoLink);

            response.put("status", "success");
            response.put("message", "Resource added successfully!");
            return response;
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return response;
        }
    }

    @PostMapping("/upload/link")
    public Map<String, String> uploadLink(
            @RequestBody Map<String, String> payload,
            HttpSession session) {
        
        // Check if admin
        if (!isAdmin(session)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Unauthorized");
            return response;
        }

        try {
            String section = payload.get("section");
            String description = payload.get("description");
            String documentLink = payload.get("documentLink");
            String videoLink = payload.get("videoLink");

            saveResource(section, description, null, documentLink, videoLink);

            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Links added successfully!");
            return response;
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return response;
        }
    }

    // ===== Resource Endpoints =====

    @GetMapping("/resources")
    public List<Map<String, String>> getResources(@RequestParam("section") String section) {
        try {
            List<Map<String, String>> resources = new ArrayList<>();
            
            File resourcesFile = new File(RESOURCES_FILE);
            if (!resourcesFile.exists()) {
                return resources;
            }

            String content = new String(Files.readAllBytes(Paths.get(RESOURCES_FILE)));
            @SuppressWarnings("unchecked")
            Map<String, List<Map<String, String>>> allResources = objectMapper.readValue(content, Map.class);

            if (allResources.containsKey(section)) {
                resources = allResources.get(section);
            }

            return resources;
        } catch (Exception e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    @PostMapping("/resources/delete")
    public Map<String, String> deleteResource(
            @RequestBody Map<String, Object> payload,
            HttpSession session) {
        
        // Check if admin
        if (!isAdmin(session)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Unauthorized");
            return response;
        }

        try {
            String section = (String) payload.get("section");
            Integer index = ((Number) payload.get("index")).intValue();

            Map<String, String> response = new HashMap<>();
            
            File resourcesFile = new File(RESOURCES_FILE);
            if (!resourcesFile.exists()) {
                response.put("status", "error");
                response.put("message", "Resources file not found");
                return response;
            }

            String content = new String(Files.readAllBytes(Paths.get(RESOURCES_FILE)));
            @SuppressWarnings("unchecked")
            Map<String, List<Map<String, String>>> allResources = objectMapper.readValue(content, Map.class);

            if (allResources.containsKey(section) && index >= 0 && index < allResources.get(section).size()) {
                List<Map<String, String>> sectionResources = allResources.get(section);
                sectionResources.remove((int) index);

                // Save updated resources
                Files.write(Paths.get(RESOURCES_FILE),
                           objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(allResources));

                response.put("status", "success");
                response.put("message", "Resource deleted successfully!");
            } else {
                response.put("status", "error");
                response.put("message", "Resource not found");
            }

            return response;
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return response;
        }
    }

    @GetMapping("/files")
    public String[] listFiles() {
        File folder = new File(UPLOAD_DIR);
        if (!folder.exists()) return new String[]{};

        return folder.list();
    }

    // ===== Helper Methods =====

    private boolean isAdmin(HttpSession session) {
        Boolean isAdmin = (Boolean) session.getAttribute("admin");
        return isAdmin != null && isAdmin;
    }

    private void saveResource(String section, String description, String file,
                             String documentLink, String videoLink) throws IOException {
        
        Map<String, List<Map<String, String>>> allResources = new HashMap<>();
        
        // Load existing resources
        File resourcesFile = new File(RESOURCES_FILE);
        if (resourcesFile.exists()) {
            String content = new String(Files.readAllBytes(Paths.get(RESOURCES_FILE)));
            @SuppressWarnings("unchecked")
            Map<String, List<Map<String, String>>> loaded = objectMapper.readValue(content, Map.class);
            allResources = loaded;
        }

        // Initialize section if not exists
        allResources.putIfAbsent(section, new ArrayList<>());

        // Create resource object
        Map<String, String> resource = new LinkedHashMap<>();
        resource.put("title", description);
        resource.put("description", description);
        if (file != null) resource.put("file", file);
        if (documentLink != null && !documentLink.isEmpty()) resource.put("documentLink", documentLink);
        if (videoLink != null && !videoLink.isEmpty()) resource.put("videoLink", videoLink);

        // Add resource to section
        allResources.get(section).add(resource);

        // Save to file
        Files.write(Paths.get(RESOURCES_FILE), 
                   objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(allResources));
    }
}