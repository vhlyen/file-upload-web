package com.file_upload_web;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@RestController
@CrossOrigin("*")
public class FileUploadController {

    private final String UPLOAD_DIR = System.getProperty("user.dir") + "/uploads";
    private final String RESOURCES_FILE = System.getProperty("user.dir") + "/resources.json";
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final long MAX_UPLOAD_BYTES = 50L * 1024L * 1024L;
    private final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "txt", "md", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "png", "jpg", "jpeg", "gif", "webp", "zip"
    );

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
            @RequestParam(value = "smallDescription", required = false) String smallDescription,
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
                uploadedFileName = storeUploadedFile(file);
            }

            // Save resource metadata
            saveResource(section, description, smallDescription, uploadedFileName, file, documentLink, videoLink, session);

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
            String smallDescription = payload.get("smallDescription");
            String documentLink = payload.get("documentLink");
            String videoLink = payload.get("videoLink");

            saveResource(section, description, smallDescription, null, null, documentLink, videoLink, session);

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

    @GetMapping("/resources/all")
    public Map<String, List<Map<String, String>>> getAllResources() {
        try {
            return loadAllResources();
        } catch (Exception e) {
            e.printStackTrace();
            return new LinkedHashMap<>();
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
                Map<String, String> removed = sectionResources.remove((int) index);
                deleteUploadedFileIfPresent(removed.get("file"));

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

    @PostMapping("/resources/update")
    public Map<String, String> updateResource(
            @RequestParam("originalSection") String originalSection,
            @RequestParam("index") Integer index,
            @RequestParam("section") String section,
            @RequestParam("description") String description,
            @RequestParam(value = "smallDescription", required = false) String smallDescription,
            @RequestParam(value = "documentLink", required = false) String documentLink,
            @RequestParam(value = "videoLink", required = false) String videoLink,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpSession session) {

        if (!isAdmin(session)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Unauthorized");
            return response;
        }

        try {
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

            if (!allResources.containsKey(originalSection) || index < 0 || index >= allResources.get(originalSection).size()) {
                response.put("status", "error");
                response.put("message", "Resource not found");
                return response;
            }

            Map<String, String> currentResource = allResources.get(originalSection).get(index);
            String uploadedFileName = currentResource.get("file");

            if (file != null && !file.isEmpty()) {
                uploadedFileName = storeUploadedFile(file);
            }

            Map<String, String> updatedResource = buildResource(description, smallDescription, uploadedFileName, file, documentLink, videoLink, session);
            preserveResourceFields(currentResource, updatedResource);

            if (originalSection.equals(section)) {
                allResources.get(originalSection).set(index, updatedResource);
            } else {
                allResources.get(originalSection).remove((int) index);
                allResources.putIfAbsent(section, new ArrayList<>());
                allResources.get(section).add(updatedResource);
            }

            Files.write(Paths.get(RESOURCES_FILE),
                       objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(allResources));

            response.put("status", "success");
            response.put("message", "Resource updated successfully!");
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

        String[] files = folder.list();
        return files != null ? files : new String[]{};
    }

    @GetMapping("/download/{fileName:.+}")
    public ResponseEntity<FileSystemResource> downloadFile(@PathVariable String fileName) throws IOException {
        String sanitizedName = sanitizeFileName(fileName);
        Path filePath = Paths.get(UPLOAD_DIR).resolve(sanitizedName).normalize();
        Path uploadRoot = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();

        if (!filePath.toAbsolutePath().startsWith(uploadRoot) || !Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }

        incrementDownloadCount(sanitizedName);

        FileSystemResource resource = new FileSystemResource(filePath);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + sanitizedName + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(Files.size(filePath)))
                .body(resource);
    }

    // ===== Helper Methods =====

    private boolean isAdmin(HttpSession session) {
        Boolean isAdmin = (Boolean) session.getAttribute("admin");
        return isAdmin != null && isAdmin;
    }

    private String storeUploadedFile(MultipartFile file) throws IOException {
        validateUploadedFile(file);
        File dir = new File(UPLOAD_DIR);
        if (!dir.exists()) dir.mkdirs();

        String uploadedFileName = System.currentTimeMillis() + "_" + sanitizeFileName(file.getOriginalFilename());
        String filePath = UPLOAD_DIR + File.separator + uploadedFileName;
        file.transferTo(new File(filePath));
        return uploadedFileName;
    }

    private void validateUploadedFile(MultipartFile file) {
        String originalName = file.getOriginalFilename();
        String extension = getFileExtension(originalName);

        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("File exceeds the 50 MB upload limit");
        }

        if (extension.isBlank() || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Unsupported file format");
        }
    }

    private String sanitizeFileName(String originalFileName) {
        if (originalFileName == null || originalFileName.isBlank()) {
            return "upload";
        }

        String fileName = Paths.get(originalFileName).getFileName().toString();
        fileName = fileName.replace("\\", "_").replace("/", "_");
        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");

        return fileName.isBlank() ? "upload" : fileName;
    }

    private Map<String, String> buildResource(String description, String smallDescription, String file,
                             MultipartFile upload, String documentLink, String videoLink, HttpSession session) {
        Map<String, String> resource = new LinkedHashMap<>();
        String now = Instant.now().toString();
        resource.put("id", UUID.randomUUID().toString());
        resource.put("title", description);
        resource.put("description", description);
        resource.put("uploadDate", now);
        resource.put("lastModified", now);
        resource.put("owner", String.valueOf(session.getAttribute("adminName") != null ? session.getAttribute("adminName") : "standard-user"));
        resource.put("downloadCount", "0");
        if (smallDescription != null && !smallDescription.isBlank()) resource.put("smallDescription", smallDescription);
        if (file != null && !file.isEmpty()) {
            resource.put("file", file);
            resource.put("originalFileName", upload != null ? sanitizeFileName(upload.getOriginalFilename()) : file.replaceFirst("^\\d+_", ""));
            resource.put("fileSize", String.valueOf(resolveFileSize(file, upload)));
            resource.put("fileType", getFileExtension(file).toUpperCase(Locale.ROOT));
        }
        if (documentLink != null && !documentLink.isBlank()) resource.put("documentLink", documentLink);
        if (videoLink != null && !videoLink.isBlank()) resource.put("videoLink", videoLink);
        return resource;
    }

    private void saveResource(String section, String description, String smallDescription, String file,
                             MultipartFile upload, String documentLink, String videoLink, HttpSession session) throws IOException {
        
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

        Map<String, String> resource = buildResource(description, smallDescription, file, upload, documentLink, videoLink, session);

        // Add resource to section
        allResources.get(section).add(resource);

        // Save to file
        Files.write(Paths.get(RESOURCES_FILE), 
                   objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(allResources));
    }

    private Map<String, List<Map<String, String>>> loadAllResources() throws IOException {
        File resourcesFile = new File(RESOURCES_FILE);
        if (!resourcesFile.exists()) {
            return new LinkedHashMap<>();
        }

        String content = new String(Files.readAllBytes(Paths.get(RESOURCES_FILE)));
        @SuppressWarnings("unchecked")
        Map<String, List<Map<String, String>>> loaded = objectMapper.readValue(content, Map.class);
        return loaded;
    }

    private void incrementDownloadCount(String fileName) throws IOException {
        Map<String, List<Map<String, String>>> allResources = loadAllResources();
        String now = Instant.now().toString();

        for (List<Map<String, String>> resources : allResources.values()) {
            for (Map<String, String> resource : resources) {
                if (fileName.equals(resource.get("file"))) {
                    int downloads = parseInt(resource.get("downloadCount"));
                    resource.put("downloadCount", String.valueOf(downloads + 1));
                    resource.put("recentlyAccessed", now);
                }
            }
        }

        Files.write(Paths.get(RESOURCES_FILE),
                objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(allResources));
    }

    private void preserveResourceFields(Map<String, String> currentResource, Map<String, String> updatedResource) {
        updatedResource.put("id", currentResource.getOrDefault("id", updatedResource.get("id")));
        updatedResource.put("uploadDate", currentResource.getOrDefault("uploadDate", updatedResource.get("uploadDate")));
        updatedResource.put("downloadCount", currentResource.getOrDefault("downloadCount", "0"));
        updatedResource.put("recentlyAccessed", currentResource.getOrDefault("recentlyAccessed", ""));

        if (!updatedResource.containsKey("file") && currentResource.containsKey("file")) {
            updatedResource.put("file", currentResource.get("file"));
            updatedResource.put("originalFileName", currentResource.getOrDefault("originalFileName", currentResource.get("file")));
            updatedResource.put("fileSize", currentResource.getOrDefault("fileSize", "0"));
            updatedResource.put("fileType", currentResource.getOrDefault("fileType", getFileExtension(currentResource.get("file")).toUpperCase(Locale.ROOT)));
        }
    }

    private void deleteUploadedFileIfPresent(String fileName) {
        if (fileName == null || fileName.isBlank()) return;

        try {
            Files.deleteIfExists(Paths.get(UPLOAD_DIR).resolve(sanitizeFileName(fileName)).normalize());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private long resolveFileSize(String fileName, MultipartFile upload) {
        if (upload != null) return upload.getSize();

        try {
            return Files.size(Paths.get(UPLOAD_DIR).resolve(fileName));
        } catch (IOException e) {
            return 0L;
        }
    }

    private String getFileExtension(String fileName) {
        if (fileName == null) return "";
        String cleanName = sanitizeFileName(fileName);
        int dotIndex = cleanName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == cleanName.length() - 1) return "";
        return cleanName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private int parseInt(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return 0;
        }
    }
}
